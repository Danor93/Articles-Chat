import { motion } from 'framer-motion';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/theme-toggle';
import { Heart, Code, Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <motion.footer 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="border-t bg-background/50 backdrop-blur-xl mt-auto"
    >
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
          {/* Left side - Project info */}
          <div className="flex flex-col items-center gap-2 md:flex-row md:gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Article Chat System
              </p>
              <p className="text-xs text-muted-foreground">
                Hybrid Go + Node.js Architecture with Claude AI
              </p>
            </div>
            
            <Separator orientation="vertical" className="hidden md:block h-8" />
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Built with</span>
              <Heart className="h-3 w-3 text-red-500 animate-pulse" />
              <span>using</span>
              <Badge variant="secondary" className="text-xs px-2 py-0">
                <Code className="h-3 w-3 mr-1" />
                React
              </Badge>
              <Badge variant="secondary" className="text-xs px-2 py-0">
                TypeScript
              </Badge>
              <Badge variant="secondary" className="text-xs px-2 py-0">
                shadcn/ui
              </Badge>
            </div>
          </div>
          
          {/* Right side - Theme toggle and links */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:block">
                Theme:
              </span>
              <ThemeToggle />
            </div>
          </div>
        </div>
        
        {/* Bottom divider */}
        <Separator className="my-4" />
        
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © 2025 Article Chat System. Powered by Claude AI.
          </p>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.a
                  href="https://github.com/Danor93/Articles-Chat"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.05 }}
                  className="flex items-center gap-1 cursor-pointer hover:text-primary transition-colors"
                >
                  <Code className="h-3 w-3" />
                  View on GitHub
                </motion.a>
              </TooltipTrigger>
              <TooltipContent>
                <p>View source code</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}