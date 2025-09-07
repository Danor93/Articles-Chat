export interface QuestionType {
  type: 'summary' | 'keywords' | 'sentiment' | 'comparison' | 'search' | 'entities' | 'general';
  confidence: number;
}

interface ChunkSource {
  article_id: string;
  article_title: string;
  chunk_id: string;
  content: string;
  relevance: number;
  position: number;
}

export interface FormattedResponse {
  answer: string;
  format: string;
  metadata?: {
    questionType: string;
    sources?: ChunkSource[];
    tokensUsed?: number;
    processingTime?: number;
    extractedData?: any;
  };
}

export class PromptEngineeringService {
  private articleMetadata: { categories: string[], sources: string[], totalCount: number } | null = null;

  private questionPatterns = {
    summary: [
      /\b(summarize|summary|overview|brief|outline|main points?)\b/i,
      /\bwhat is .+ about\b/i,
      /\bgive me a summary\b/i,
      /\btell me about\b/i
    ],
    keywords: [
      /\b(keywords?|key terms?|main topics?|topics?|themes?)\b/i,
      /\bextract .+ (keywords?|terms?|topics?)\b/i,
      /\bwhat are the main .+ discussed\b/i
    ],
    sentiment: [
      /\b(sentiment|tone|feeling|mood|positive|negative|opinion)\b/i,
      /\bhow does .+ feel about\b/i,
      /\bwhat is the tone\b/i,
      /\bis .+ positive or negative\b/i
    ],
    comparison: [
      /\b(compare|comparison|difference|differences|similar|contrast)\b/i,
      /\bhow do .+ differ\b/i,
      /\bwhat are the .+ between\b/i,
      /\bwhich .+ is more\b/i
    ],
    search: [
      /\bwhat articles? .+ (discuss|mention|talk about|cover)\b/i,
      /\bwhich articles?\b/i,
      /\bfind articles? .+ about\b/i,
      /\bshow me articles?\b/i
    ],
    entities: [
      /\b(entities|people|organizations|companies|locations|names)\b/i,
      /\bwho is mentioned\b/i,
      /\bwhat .+ are discussed\b/i,
      /\bmost (common|frequently) (mentioned|discussed)\b/i
    ]
  };

  classifyQuestion(query: string): QuestionType {
    let bestMatch: QuestionType = { type: 'general', confidence: 0 };

    for (const [type, patterns] of Object.entries(this.questionPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          const confidence = this.calculateConfidence(query, pattern);
          if (confidence > bestMatch.confidence) {
            bestMatch = { 
              type: type as QuestionType['type'], 
              confidence 
            };
          }
        }
      }
    }

    return bestMatch;
  }

  private calculateConfidence(query: string, pattern: RegExp): number {
    const matches = query.match(pattern);
    if (!matches) return 0;
    
    // Base confidence from match
    let confidence = 0.7;
    
    // Boost confidence for longer matches
    const matchLength = matches[0].length;
    confidence += Math.min(matchLength / query.length, 0.2);
    
    // Boost confidence for multiple keyword matches
    const keywordCount = query.toLowerCase().split(' ').length;
    if (keywordCount > 5) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  setArticleMetadata(articles: any[]): void {
    const categories = new Set<string>();
    const sources = new Set<string>();

    articles.forEach(article => {
      if (article.category) {
        categories.add(article.category);
      }
      if (article.url) {
        try {
          const domain = new URL(article.url).hostname.replace('www.', '');
          sources.add(domain);
        } catch {
          // Skip invalid URLs
        }
      }
    });

    this.articleMetadata = {
      categories: Array.from(categories),
      sources: Array.from(sources),
      totalCount: articles.length
    };
  }

  incrementArticleCount(newArticleUrl: string): void {
    if (!this.articleMetadata) {
      this.articleMetadata = {
        categories: [],
        sources: [],
        totalCount: 1
      };
    } else {
      this.articleMetadata.totalCount++;
    }

    // Try to add the new source domain
    try {
      const domain = new URL(newArticleUrl).hostname.replace('www.', '');
      if (!this.articleMetadata.sources.includes(domain)) {
        this.articleMetadata.sources.push(domain);
        console.log(`✓ Added new source domain: ${domain}`);
        console.log(`✓ Updated article count: ${this.articleMetadata.totalCount} articles from ${this.articleMetadata.sources.length} sources`);
      } else {
        console.log(`✓ Article count updated: ${this.articleMetadata.totalCount} articles (existing source: ${domain})`);
      }
    } catch (error) {
      console.warn(`Could not extract domain from URL: ${newArticleUrl}`, error);
    }
  }

  private getArticleOverview(): string {
    if (!this.articleMetadata) {
      return "I have access to a collection of articles from various sources covering diverse topics.";
    }

    const { categories, sources, totalCount } = this.articleMetadata;
    
    let overview = `I have access to ${totalCount} articles from various reputable sources`;
    
    // Add sources if not too many
    if (sources.length <= 5) {
      overview += ` including ${sources.join(', ')}`;
    } else {
      overview += ` including ${sources.slice(0, 3).join(', ')}, and ${sources.length - 3} other sources`;
    }
    
    overview += ` covering diverse topics`;
    
    // Add categories if not too many
    if (categories.length <= 8) {
      overview += ` such as ${categories.join(', ')}`;
    } else {
      overview += ` including ${categories.slice(0, 5).join(', ')}, and ${categories.length - 5} other categories`;
    }
    
    return overview + ".";
  }

  private isIntroductionQuery(query: string): boolean {
    const introPatterns = [
      /\b(hello|hi|hey)\b.*\bwhat can you do\b/i,
      /\bwhat are you capable of\b/i,
      /\bwhat can you help me with\b/i,
      /\btell me about yourself\b/i,
      /\bwhat are your capabilities\b/i,
      /\bwhat do you do\b/i,
      /\bhow can you help\b/i,
      /\bwhat is your purpose\b/i,
      /\bwho are you\b/i,
      /\bwho r you\b/i,
      /\bwhat are you\b/i
    ];
    
    return introPatterns.some(pattern => pattern.test(query));
  }

  generatePrompt(query: string, questionType: QuestionType, context: string): string {
    // For general introduction queries, don't use specific article context
    const isIntroductionQuery = this.isIntroductionQuery(query);
    const baseContext = isIntroductionQuery ? '' : `Context from Articles:\n${context}\n\n`;
    
    switch (questionType.type) {
      case 'summary':
        return `${baseContext}User Query: ${query}

You are an expert article analyst. Provide a comprehensive summary based on the context provided. Structure your response as follows:

## Summary

[Provide a clear, structured summary covering the main points, key findings, and important details from the articles]

## Key Points

• [First key point with supporting details]

• [Second key point with supporting details]

• [Additional key points as needed]

## Key Sentences from the Article

• "[Direct quote 1 - exact sentence from the article]"

• "[Direct quote 2 - exact sentence from the article]"

• "[Direct quote 3 - exact sentence from the article]"

• "[Additional important sentences as needed]"

## Conclusion
[Brief conclusion highlighting the most important takeaways]

IMPORTANT: Include actual sentences and quotes directly from the provided context. Base your analysis entirely on the article content provided and include specific examples and direct quotes to support each point.`;

      case 'keywords':
        return `${baseContext}User Query: ${query}

You are an expert content analyzer. Extract and analyze keywords and main topics directly from the provided articles. Structure your response as follows:

## Keywords & Topics Analysis

### Primary Keywords (from article text)

• **[Keyword 1]** - "[Direct quote where this keyword appears]" (appears X times)

• **[Keyword 2]** - "[Direct quote where this keyword appears]" (appears X times)  

• **[Keyword 3]** - "[Direct quote where this keyword appears]" (appears X times)

### Main Topics Discussed

• **[Topic 1]**: "[Specific excerpt from article discussing this topic]"

• **[Topic 2]**: "[Specific excerpt from article discussing this topic]"

• **[Topic 3]**: "[Specific excerpt from article discussing this topic]"

### Key Entities Mentioned

• **People**: [Names found in articles] - "[Quote mentioning them]"

• **Organizations**: [Companies/orgs found] - "[Quote mentioning them]"

• **Locations**: [Places mentioned] - "[Quote mentioning them]"

### Thematic Categories

• **[Category 1]**: [Keywords found] - "[Supporting quotes from articles]"

• **[Category 2]**: [Keywords found] - "[Supporting quotes from articles]"

CRITICAL: Extract everything directly from the provided article context. Include actual quotes and specific references. Do not generate generic keywords.`;

      case 'sentiment':
        return `${baseContext}User Query: ${query}

You are an expert sentiment analyst. Analyze the sentiment and tone of the provided articles using ONLY the actual article content. Structure your response as follows:

## Sentiment Analysis

### Overall Sentiment
[Positive/Negative/Neutral/Mixed] - Confidence: [High/Medium/Low]

**Evidence**: "[Direct quote from article that supports this sentiment assessment]"

### Article-by-Article Breakdown

• **Article 1** ([Source name]): [Sentiment] 
  - **Quote**: "[Specific sentence showing this sentiment]"
  - **Language indicators**: [Actual words/phrases from text]

• **Article 2** ([Source name]): [Sentiment]
  - **Quote**: "[Specific sentence showing this sentiment]"  
  - **Language indicators**: [Actual words/phrases from text]

### Tone Analysis

• **Writing Style**: [Based on actual article language] - "[Quote example]"

• **Emotional Language**: "[Direct quotes showing emotional language]"

• **Bias Indicators**: "[Specific phrases showing potential bias]"

### Comparative Sentiment (if multiple articles)

• **Most Positive**: "[Article name]" - "[Quote showing positivity]"

• **Most Negative**: "[Article name]" - "[Quote showing negativity]"

• **Most Neutral/Objective**: "[Article name]" - "[Quote showing objectivity]"

### Key Sentiment Phrases Found

• "[Actual positive phrase from article]" - Positive indicator
• "[Actual negative phrase from article]" - Negative indicator  
• "[Actual neutral phrase from article]" - Neutral indicator

CRITICAL: Base ALL analysis on actual quotes and phrases from the provided articles. Reference specific article sources. Do not generate hypothetical sentiment analysis.`;

      case 'comparison':
        return `${baseContext}User Query: ${query}

You are an expert comparative analyst. Compare and contrast the articles based on the provided context using ONLY actual article content. Structure your response as follows:

## Comparative Analysis

### Articles Being Compared
• **Article 1**: "[Article title/source]" - "[Brief description from content]"
• **Article 2**: "[Article title/source]" - "[Brief description from content]"

### Content Similarities

• **[Similarity 1]**: 
  - Article 1: "[Direct quote supporting this similarity]"
  - Article 2: "[Direct quote supporting this similarity]"

• **[Similarity 2]**:
  - Article 1: "[Direct quote supporting this similarity]"
  - Article 2: "[Direct quote supporting this similarity]"

### Key Content Differences

• **[Difference 1]**: 
  - Article 1: "[Quote showing first perspective]"
  - Article 2: "[Quote showing contrasting perspective]"

• **[Difference 2]**:
  - Article 1: "[Quote showing first approach]"
  - Article 2: "[Quote showing different approach]"

### Tone & Style Comparison

• **[Source 1] Tone**: [Objective/Opinion/etc.] - "[Quote demonstrating tone]"

• **[Source 2] Tone**: [Objective/Opinion/etc.] - "[Quote demonstrating tone]"

• **Key Differences in Language**: "[Specific examples of language differences]"

### Source Perspective Analysis

• **[Source 1] Focus**: "[What this source emphasizes]" - "[Supporting quote]"

• **[Source 2] Focus**: "[What this source emphasizes]" - "[Supporting quote]"

### Unique Information

• **Only in [Article 1]**: "[Unique information found]" - "[Quote]"

• **Only in [Article 2]**: "[Unique information found]" - "[Quote]"

### Conclusion
[Analysis based on actual content differences and similarities found]

CRITICAL: Compare only what is actually in the provided articles. Use direct quotes and specific references. Identify actual tone differences between sources using their actual language.`;

      case 'search':
        return `${baseContext}User Query: ${query}

You are an expert article search analyst. Search through the provided articles to find content matching the query. Use ONLY the actual article content provided. Structure your response as follows:

## Search Results: "${query}"

### Articles Found

• **[Article Title/Source]**: 
  - **Relevance**: [High/Medium/Low] - [Why it matches]
  - **Key Quote**: "[Direct quote from article that matches the search]"  
  - **Context**: "[Additional relevant excerpt]"

• **[Article Title/Source]**:
  - **Relevance**: [High/Medium/Low] - [Why it matches]
  - **Key Quote**: "[Direct quote from article that matches the search]"
  - **Context**: "[Additional relevant excerpt]"

### Topic Analysis

• **Main Theme Found**: "[What the search query is actually about in these articles]"

• **Key Terms Mentioned**: [Actual terms found in articles] - "[Quotes containing these terms]"

• **Specific Details**: 
  - "[Specific fact/data from articles]"
  - "[Another specific fact/data from articles]"

### Comparative Assessment (for evaluative queries)

• **Most Positive**: "[Article name]" - "[Quote showing positive stance]"

• **Most Negative**: "[Article name]" - "[Quote showing negative stance]"

• **Most Detailed**: "[Article name]" - "[Quote showing detailed coverage]"

### Direct Answers from Articles

• **Question**: ${query}
• **Answer**: "[Direct information from articles answering this question]"
• **Sources**: "[Which specific articles provided this information]"

### Supporting Evidence

• "[Quote 1 supporting the findings]" - (Source: [Article name])
• "[Quote 2 supporting the findings]" - (Source: [Article name])
• "[Quote 3 supporting the findings]" - (Source: [Article name])

CRITICAL: Only report what is actually found in the provided articles. Use direct quotes and specific references. For queries like "Which article is more positive about X?" - compare actual language used. For "What articles discuss Y?" - only list articles that actually mention the topic with quotes as evidence.`;

      case 'entities':
        return `${baseContext}User Query: ${query}

You are an expert entity extraction analyst. Extract and analyze entities mentioned in the provided articles using ONLY the actual article content. Structure your response as follows:

## Entity Extraction Analysis

### People Mentioned

• **[Person Name]**: 
  - **Role**: [How they're described in articles]
  - **Quote**: "[Direct quote mentioning this person]"
  - **Frequency**: Mentioned in [X] articles
  - **Context**: "[What the articles say about them]"

• **[Person Name]**: 
  - **Role**: [How they're described in articles]  
  - **Quote**: "[Direct quote mentioning this person]"
  - **Context**: "[What the articles say about them]"

### Organizations/Companies

• **[Company Name]**: 
  - **Industry**: [What the articles say about their business]
  - **Quote**: "[Direct quote mentioning this company]"
  - **Frequency**: Mentioned in [X] articles
  - **News Context**: "[What news/events involve this company]"

• **[Company Name]**: [Similar structure]

### Locations/Countries

• **[Location Name]**: 
  - **Context**: [How it's mentioned in articles]
  - **Quote**: "[Direct quote mentioning this location]" 
  - **Relevance**: "[Why this location is discussed]"

### Most Commonly Discussed Entities

• **#1 Most Mentioned**: "[Entity name]" - Appears [X] times
  - "[Quote example 1]"
  - "[Quote example 2]"

• **#2 Most Mentioned**: "[Entity name]" - Appears [X] times  
  - "[Quote example 1]"
  - "[Quote example 2]"

• **#3 Most Mentioned**: "[Entity name]" - Appears [X] times
  - "[Quote example 1]"

### Cross-Article Entity Analysis

• **Entities appearing in multiple articles**:
  - "[Entity]": In [X] articles - "[Quote from article 1]" and "[Quote from article 2]"
  - "[Entity]": In [X] articles - "[Quote from article 1]" and "[Quote from article 2]"

### Entity Relationships (from article content)

• **[Entity 1]** and **[Entity 2]**: "[Direct quote showing their relationship]"
• **[Entity 3]** and **[Entity 4]**: "[Direct quote showing their relationship]"

### Key Topics/Themes Connected to Entities

• **[Topic]** involves: [List of entities] - "[Supporting quote]"
• **[Topic]** involves: [List of entities] - "[Supporting quote]"

CRITICAL: Extract ONLY entities that are actually mentioned in the provided articles. Include direct quotes as evidence for every entity. Count frequency based on actual appearances in the text. Do not generate hypothetical entities.`;

      case 'general':
      default:
        return `${baseContext}User Query: ${query}

I'm Clarticle, your AI article analysis assistant powered by Claude AI. I'm designed to provide clear, intelligent insights about articles using Retrieval-Augmented Generation (RAG) technology.

${this.getArticleOverview()}

**As Clarticle, my core capabilities include:**
I specialize in helping you analyze and chat about articles with crystal-clear responses. Here's what I can do:

• **Article Summaries**: Provide comprehensive overviews of specific articles or topics
• **Keyword & Topic Extraction**: Identify main themes, key terms, and central concepts
• **Sentiment Analysis**: Analyze tone, mood, and perspective of articles or topics
• **Comparative Analysis**: Compare multiple articles, sources, or viewpoints on similar topics
• **Entity Recognition**: Identify and analyze people, organizations, locations, and other entities
• **Thematic Search**: Find articles discussing specific topics (e.g., economic trends, AI developments, etc.)
• **Source Comparison**: Analyze differences in tone, perspective, or coverage between different sources

**Example Questions I Can Answer:**
• "What are the key differences in tone between different sources on similar topics?"
• "Which articles discuss economic trends or business developments?"
• "What is the sentiment around AI regulation or technology policy in recent articles?"
• "Who are the most commonly mentioned entities across the articles?"
• "Compare coverage of specific companies or technologies across different sources"
• "What are the main topics being discussed in the current article collection?"

## Response

[Provide a well-structured, informative response based ONLY on the provided article content]

## Supporting Evidence from Articles

• **Key Points**: [Relevant information directly from the articles] - "[Supporting quote]"

• **Direct Quotes**: "[Specific sentence or passage from article]" - (Source: [Article name])

• **Specific Examples**: "[Actual examples found in the articles]" - "[Quote showing this example]"

• **Context from Articles**: "[Additional context directly from the provided articles]"

## Sources Reference

• **Primary Sources**: [Which specific articles provided the main information]
• **Supporting Sources**: [Which articles provided additional context]
• **Key Facts from**: [Article name] - "[Most important quote/fact]"

## Important Limitations

If you cannot answer the question based on the provided article context, clearly state: "Based on the provided articles, I cannot find information about [specific aspect]. The articles discuss [what they actually discuss instead]."

CRITICAL: Use ONLY information from the provided articles. Include direct quotes as evidence. Reference specific article sources. Do not generate information not found in the provided context.`;
    }
  }

  formatResponse(rawResponse: string, questionType: QuestionType, query: string): FormattedResponse {
    return {
      answer: rawResponse,
      format: this.getResponseFormat(questionType.type),
      metadata: {
        questionType: questionType.type,
        // sources will be set by the langchain service
        extractedData: this.extractStructuredData(rawResponse, questionType.type)
      }
    };
  }

  private getResponseFormat(type: QuestionType['type']): string {
    const formats = {
      summary: 'structured_summary',
      keywords: 'keyword_list',
      sentiment: 'sentiment_analysis',
      comparison: 'comparative_analysis',
      search: 'article_list',
      entities: 'entity_extraction',
      general: 'conversational'
    };
    return formats[type] || 'conversational';
  }

  private extractSources(response: string): string[] {
    const sources: string[] = [];
    const sourcePatterns = [
      /\*\*\[(.*?)\]\*\*/g,
      /Source: (.*?)(?:\n|$)/g,
      /According to (.*?)(?:,|\.|:)/g
    ];

    for (const pattern of sourcePatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        sources.push(match[1].trim());
      }
    }

    return [...new Set(sources)]; // Remove duplicates
  }

  private extractStructuredData(response: string, type: QuestionType['type']): any {
    switch (type) {
      case 'keywords':
        return this.extractKeywords(response);
      case 'sentiment':
        return this.extractSentimentData(response);
      case 'entities':
        return this.extractEntityData(response);
      default:
        return null;
    }
  }

  private extractKeywords(response: string): { primary: string[], secondary: string[], categories: any } {
    const keywords = {
      primary: [] as string[],
      secondary: [] as string[],
      categories: {} as any
    };

    // Extract primary keywords
    const primaryMatch = response.match(/### Primary Keywords\n([\s\S]*?)(?=\n###|$)/);
    if (primaryMatch) {
      const primarySection = primaryMatch[1];
      const keywordMatches = primarySection.match(/• (.*?) -/g);
      if (keywordMatches) {
        keywords.primary = keywordMatches.map(match => match.replace(/• (.*?) -.*/, '$1').trim());
      }
    }

    // Extract secondary topics
    const secondaryMatch = response.match(/### Secondary Topics\n([\s\S]*?)(?=\n###|$)/);
    if (secondaryMatch) {
      const secondarySection = secondaryMatch[1];
      const topicMatches = secondarySection.match(/• (.*?)(?:\n|$)/g);
      if (topicMatches) {
        keywords.secondary = topicMatches.map(match => match.replace(/• /, '').trim());
      }
    }

    return keywords;
  }

  private extractSentimentData(response: string): { overall: string, tone: string, confidence: string } {
    const sentimentData = {
      overall: 'neutral',
      tone: 'objective',
      confidence: 'medium'
    };

    // Extract overall sentiment
    const overallMatch = response.match(/### Overall Sentiment\n(.*?) - .*?Confidence level: (.*?)(?:\n|$)/);
    if (overallMatch) {
      sentimentData.overall = overallMatch[1].toLowerCase();
      sentimentData.confidence = overallMatch[2].toLowerCase();
    }

    // Extract tone
    const toneMatch = response.match(/\*\*Tone\*\*: (.*?)(?:\n|$)/);
    if (toneMatch) {
      sentimentData.tone = toneMatch[1].toLowerCase();
    }

    return sentimentData;
  }

  private extractEntityData(response: string): { people: string[], organizations: string[], locations: string[], other: string[] } {
    const entities = {
      people: [] as string[],
      organizations: [] as string[],
      locations: [] as string[],
      other: [] as string[]
    };

    // Extract people
    const peopleMatch = response.match(/### People\n([\s\S]*?)(?=\n###|$)/);
    if (peopleMatch) {
      const peopleSection = peopleMatch[1];
      const peopleMatches = peopleSection.match(/• (.*?):/g);
      if (peopleMatches) {
        entities.people = peopleMatches.map(match => match.replace(/• (.*?):/, '$1').trim());
      }
    }

    // Extract organizations
    const orgsMatch = response.match(/### Organizations\/Companies\n([\s\S]*?)(?=\n###|$)/);
    if (orgsMatch) {
      const orgsSection = orgsMatch[1];
      const orgMatches = orgsSection.match(/• (.*?):/g);
      if (orgMatches) {
        entities.organizations = orgMatches.map(match => match.replace(/• (.*?):/, '$1').trim());
      }
    }

    // Extract locations
    const locationsMatch = response.match(/### Locations\n([\s\S]*?)(?=\n###|$)/);
    if (locationsMatch) {
      const locationsSection = locationsMatch[1];
      const locationMatches = locationsSection.match(/• (.*?):/g);
      if (locationMatches) {
        entities.locations = locationMatches.map(match => match.replace(/• (.*?):/, '$1').trim());
      }
    }

    return entities;
  }
}

export const promptEngineeringService = new PromptEngineeringService();