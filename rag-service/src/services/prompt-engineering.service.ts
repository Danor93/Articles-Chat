export interface QuestionType {
  type: 'summary' | 'keywords' | 'sentiment' | 'comparison' | 'search' | 'entities' | 'general';
  confidence: number;
}

export interface FormattedResponse {
  answer: string;
  format: string;
  metadata?: {
    questionType: string;
    sources?: string[];
    extractedData?: any;
  };
}

export class PromptEngineeringService {
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

  generatePrompt(query: string, questionType: QuestionType, context: string): string {
    const baseContext = `Context from Articles:\n${context}\n\n`;
    
    switch (questionType.type) {
      case 'summary':
        return `${baseContext}User Query: ${query}

You are an expert article analyst. Provide a comprehensive summary based on the context provided. Structure your response as follows:

## Summary

[Provide a clear, structured summary covering the main points, key findings, and important details from the articles]

## Key Points
• [First key point]
• [Second key point]
• [Additional key points as needed]

## Conclusion
[Brief conclusion highlighting the most important takeaways]

Please ensure your summary is accurate, well-organized, and based solely on the provided context.`;

      case 'keywords':
        return `${baseContext}User Query: ${query}

You are an expert content analyzer. Extract and analyze keywords and main topics from the provided articles. Structure your response as follows:

## Keywords & Topics

### Primary Keywords
• [Most important keyword 1] - [brief context]
• [Most important keyword 2] - [brief context]
• [Most important keyword 3] - [brief context]

### Secondary Topics
• [Secondary topic 1]
• [Secondary topic 2]
• [Additional topics as needed]

### Thematic Categories
• **[Category 1]**: [Related keywords]
• **[Category 2]**: [Related keywords]

Base your analysis solely on the provided context and provide specific examples where possible.`;

      case 'sentiment':
        return `${baseContext}User Query: ${query}

You are an expert sentiment analyst. Analyze the sentiment and tone of the provided articles. Structure your response as follows:

## Sentiment Analysis

### Overall Sentiment
[Positive/Negative/Neutral/Mixed] - [Confidence level: High/Medium/Low]

### Detailed Breakdown
• **Tone**: [Objective/Subjective/Optimistic/Pessimistic/etc.]
• **Emotional Indicators**: [Specific phrases or words indicating sentiment]
• **Bias Assessment**: [Any detected bias or perspective]

### Supporting Evidence
• [Quote or example 1 showing sentiment]
• [Quote or example 2 showing sentiment]

### Conclusion
[Summary of overall sentiment with confidence assessment]

Provide specific examples and quotes to support your analysis.`;

      case 'comparison':
        return `${baseContext}User Query: ${query}

You are an expert comparative analyst. Compare and contrast the articles or topics based on the provided context. Structure your response as follows:

## Comparative Analysis

### Key Similarities
• [Similarity 1]: [Details and examples]
• [Similarity 2]: [Details and examples]

### Key Differences
• [Difference 1]: [Detailed comparison with examples]
• [Difference 2]: [Detailed comparison with examples]

### Unique Aspects
• **[Article/Topic 1]**: [Unique points]
• **[Article/Topic 2]**: [Unique points]

### Analysis Summary
[Overall assessment of similarities, differences, and significance]

Provide specific examples and quotes to support your comparative analysis.`;

      case 'search':
        return `${baseContext}User Query: ${query}

You are an expert article curator. Search through and identify relevant articles based on the query. Structure your response as follows:

## Article Search Results

### Matching Articles
• **[Article 1 Title/Source]**: [Relevance explanation and key points]
• **[Article 2 Title/Source]**: [Relevance explanation and key points]
• **[Additional articles as found]**

### Relevance Summary
• **Highly Relevant**: [Number] articles directly addressing the topic
• **Moderately Relevant**: [Number] articles with related content
• **Tangentially Related**: [Number] articles with minor connections

### Key Themes Found
• [Theme 1]: [Found in which articles]
• [Theme 2]: [Found in which articles]

### Recommendation
[Which articles best answer the user's query and why]

Focus on providing accurate article identification and relevance assessment.`;

      case 'entities':
        return `${baseContext}User Query: ${query}

You are an expert entity extraction analyst. Identify and analyze entities mentioned in the articles. Structure your response as follows:

## Entity Analysis

### People
• [Person 1]: [Role/context/frequency of mention]
• [Person 2]: [Role/context/frequency of mention]

### Organizations/Companies
• [Organization 1]: [Context and significance]
• [Organization 2]: [Context and significance]

### Locations
• [Location 1]: [Relevance and context]
• [Location 2]: [Relevance and context]

### Other Important Entities
• [Entity 1]: [Type and significance]
• [Entity 2]: [Type and significance]

### Most Frequently Mentioned
1. [Entity name] - [Frequency/context]
2. [Entity name] - [Frequency/context]
3. [Entity name] - [Frequency/context]

### Entity Relationships
• [Description of how entities relate to each other and the main topics]

Focus on accuracy and provide context for why each entity is significant.`;

      case 'general':
      default:
        return `${baseContext}User Query: ${query}

You are a helpful AI assistant for an article chat system. Use the provided context to answer the user's question comprehensively and accurately.

## Response

[Provide a well-structured, informative response based on the articles]

## Supporting Information

• **Key Points**: [Relevant key points from the articles]
• **Examples**: [Specific examples or quotes when applicable]
• **Context**: [Additional context that helps answer the question]

## Sources Reference

[Brief mention of which articles or sources provided the information]

If you cannot answer the question based on the provided context, clearly state this limitation and suggest what additional information might be needed.`;
    }
  }

  formatResponse(rawResponse: string, questionType: QuestionType, query: string): FormattedResponse {
    return {
      answer: rawResponse,
      format: this.getResponseFormat(questionType.type),
      metadata: {
        questionType: questionType.type,
        sources: this.extractSources(rawResponse),
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