import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Send, 
  Inbox, 
  History, 
  LogOut,
  Shield,
  CreditCard
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Relationships', icon: Users, matchPaths: ['/', '/relationship'] },
  { path: '/identity', label: 'Identity', icon: CreditCard, matchPaths: ['/identity'] },
  { path: '/invite', label: 'Invite', icon: Send, matchPaths: ['/invite'] },
  { path: '/inbox', label: 'Inbox', icon: Inbox, matchPaths: ['/inbox'] },
  { path: '/audit', label: 'Activity', icon: History, matchPaths: ['/audit'] },
];

function isNavItemActive(pathname: string, matchPaths: string[]): boolean {
  return matchPaths.some(path => 
    path === '/' 
      ? pathname === '/' || pathname.startsWith('/relationship')
      : pathname.startsWith(path)
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { member, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg trust-gradient">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Opn3</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = isNavItemActive(location.pathname, item.matchPaths);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {member?.handle || member?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const isActive = isNavItemActive(location.pathname, item.matchPaths);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className="container py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  );
}
