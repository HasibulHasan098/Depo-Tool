import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  query: string;
  onSearch: (q: string) => void;
}

export function Header({ query, onSearch }: HeaderProps) {
  return (
    <header className="h-16 flex items-center justify-between px-8 bg-background/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">DEPO Tool</h1>
      </div>

      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9 bg-muted/50 border-transparent focus:bg-background focus:border-primary/20 rounded-full transition-all"
            placeholder="Search..." 
          />
        </div>
      </div>
      
      <div className="w-8" /> {/* Spacer for balance */}
    </header>
  );
}
