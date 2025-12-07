import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import LinktreeLink from "./LinktreeLink";
import { Bus, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import ShuttleSchedule from "./ShuttleSchedule";
import TottiLogo from "./TottiLogo";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import React, { useState } from "react";
import AdminLoginDialog from "./AdminLoginDialog";

const WhatsAppIcon = ({ className = "h-5 w-5 text-primary" }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
  </svg>
);

const userLinks = [
  {
    title: "Book Your Shuttle Now",
    href: "/book",
    icon: <Bus className="h-5 w-5 text-primary" />,
  },
  {
    title: "Urgent Contact / Support",
    href: "https://wa.me/27627532977",
    icon: <WhatsAppIcon />,
  },
];

const adminLinks = [
  {
    title: "Admin Dashboard",
    href: "/admin",
    icon: <LayoutDashboard className="h-5 w-5 text-primary" />,
  },
];

const TottiLinktree: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("admin") === "1") return true;
      if (sessionStorage.getItem("totti_admin") === "1") return true;
      return localStorage.getItem("totti_admin") === "1";
    } catch (_) {
      return false;
    }
  });
  const [loginOpen, setLoginOpen] = useState(false);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-primary relative overflow-hidden">
      {/* Background Video */}
      <video 
        autoPlay 
        muted 
        loop 
        playsInline
        preload="metadata"
        className="absolute top-0 left-0 w-full h-full object-cover opacity-40"
      >
        <source src="/totti-video.mp4" type="video/mp4" />
      </video>
      
      {/* Gradient Overlay - 95% opacity at top, 5% at bottom */}
      <div 
        className="absolute top-0 left-0 w-full h-full z-5"
        style={{
          background: 'linear-gradient(to bottom, rgba(30,58,138,0.95) 0%, rgba(124,45,18,0.5) 50%, rgba(0,0,0,0.05) 100%)'
        }}
      />
      
      {/* Content Overlay */}
      <div className="relative z-10 w-full max-w-md mx-auto">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <CardContent className="flex flex-col items-center p-0">
          {!isAdmin && (
            <div className="w-full flex items-center justify-end">
              <Button
                variant="ghost"
                className="hover:bg-transparent gap-2"
                aria-label="Admin Login"
                onClick={() => setLoginOpen(true)}
              >
                <LogIn className="h-[1.8rem] w-[1.8rem] text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Log in</span>
              </Button>
            </div>
          )}
          <img
            src="/totti-logo.svg"
            alt="Totti Shuttle and Charter Logo"
            className="mb-4 w-full max-w-xs h-auto object-contain"
          />
          
          
          {!isAdmin && (
            <p className="text-md text-muted-foreground mb-8 text-center" style={{ marginTop: '40px' }}>
              Reliable, on-time group shuttle service to King Phalo Airport daily from Mthatha and Qtn.
            </p>
          )}

          <div className="w-full space-y-6 mb-8">
          {!isAdmin && (
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">For Passengers</div>
              <div className="space-y-4">
                {userLinks.map((link) => (
                  <LinktreeLink
                    key={link.title}
                    title={link.title}
                    href={link.href}
                    icon={link.icon}
                  />
                ))}
              </div>
            </div>
          )}
            {isAdmin && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm uppercase tracking-wide text-muted-foreground">Client / Booking System</div>
                  <Button variant="ghost" className="hover:bg-transparent gap-2" aria-label="Logout" onClick={() => { try { localStorage.removeItem('totti_admin'); sessionStorage.removeItem('totti_admin'); } catch (_) {}; setIsAdmin(false); }}>
                    <LogOut className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Log out</span>
                  </Button>
                </div>
                <div className="space-y-4">
                  {adminLinks.map((link) => (
                    <LinktreeLink
                      key={link.title}
                      title={link.title}
                      href={link.href}
                      icon={link.icon}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {!isAdmin && <ShuttleSchedule />}

        </CardContent>
      </Card>
      <AdminLoginDialog open={loginOpen} onOpenChange={setLoginOpen} onSuccess={() => setIsAdmin(true)} />
      <p className="mt-8 text-sm text-primary-foreground text-center w-full">
        &copy; {new Date().getFullYear()} Totti Shuttle Service. All rights reserved.
      </p>
      </div>
    </div>
  );
};

export default TottiLinktree;
