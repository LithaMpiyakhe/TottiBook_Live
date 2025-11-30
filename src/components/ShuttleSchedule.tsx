import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PlaneTakeoff, Clock } from "lucide-react";

interface ScheduleItemProps {
  departure: string;
  arrival: string;
  route: string;
}

const ScheduleItem: React.FC<ScheduleItemProps> = ({ departure, arrival, route }) => (
  <div className="flex justify-between items-center py-2">
    <div className="flex items-center space-x-2">
      <PlaneTakeoff className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium">{route}</span>
    </div>
    <div className="text-right">
      <p className="text-sm font-semibold">Dep: {departure}</p>
      <p className="text-xs text-muted-foreground">Arr: {arrival}</p>
    </div>
  </div>
);

const ShuttleSchedule: React.FC = () => {
  return (
    <Accordion type="single" collapsible className="w-full font-akwe-pro">
      <AccordionItem value="schedule" className="border-2 border-dashed border-input/50 bg-secondary/30 rounded-lg" style={{ marginTop: '-20px' }}>
        <AccordionTrigger className="hover:no-underline p-0 data-[state=open]:border-b data-[state=open]:border-dashed data-[state=open]:border-input/50 group">
          <CardHeader className="p-4 w-full">
            <CardTitle className="text-base flex items-center justify-center space-x-2 font-normal">
              <Clock className="h-4 w-4 text-primary" />
              <span>View Daily Shuttle Schedule</span>
            </CardTitle>
          </CardHeader>
        </AccordionTrigger>
        <AccordionContent>
          <CardContent className="p-4 pt-2 space-y-2">
            <h3 className="text-sm font-bold text-center text-primary/80 mb-2">Mthatha ↔ King Phalo Airport</h3>
            
            <ScheduleItem 
              route="Mthatha → King Phalo" 
              departure="4:00 AM (Ultra City)" 
              arrival="7:00 AM" 
            />
            <Separator />
            <ScheduleItem 
              route="King Phalo → Mthatha" 
              departure="7:30 AM" 
              arrival="10:30 AM" 
            />
            <Separator />
            <ScheduleItem 
              route="Mthatha → King Phalo" 
              departure="11:00 AM" 
              arrival="2:00 PM (14:00)" 
            />
            <Separator />
            <ScheduleItem 
              route="King Phalo → Mthatha" 
              departure="2:30 PM (14:30)" 
              arrival="5:30 PM (17:30)" 
            />
            
            <p className="mt-4 text-xs text-center text-muted-foreground italic pt-2 border-t font-light">
              Queenstown Route Schedule is Subject to Demand for now.
            </p>
          </CardContent>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default ShuttleSchedule;