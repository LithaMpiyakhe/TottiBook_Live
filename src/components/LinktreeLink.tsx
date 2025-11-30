import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LinktreeLinkProps {
  href: string;
  title: string;
  icon?: React.ReactNode;
}

const LinktreeLink: React.FC<LinktreeLinkProps> = ({ href, title, icon }) => {
  const isInternal = href.startsWith("/");
  return (
    <Button
      asChild
      variant="outline"
      className={cn(
        "w-full justify-between h-14 text-lg font-semibold transition-transform duration-200 hover:scale-[1.02] shadow-md",
        "bg-card hover:bg-secondary/80 border-2 border-input",
      )}
    >
      <a href={href} {...(isInternal ? {} : { target: "_blank", rel: "noopener noreferrer" })}>
        <span className="flex items-center space-x-3">
          {icon}
          <span>{title}</span>
        </span>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
      </a>
    </Button>
  );
};

export default LinktreeLink;
