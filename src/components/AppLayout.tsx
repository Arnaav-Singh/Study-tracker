import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from '@/services/firebase';
import { useNavigate, Link } from 'react-router-dom';
import { Calendar, Check, ListTodo, User, Menu,IndianRupee } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const AppLayout = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();

  // Automatically collapse sidebar on mobile devices
  useEffect(() => {
    if (isMobile) {
      setIsCollapsed(true);
    }
  }, [isMobile]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      toast({
        title: 'Error signing out',
        description: 'There was a problem signing out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <SidebarProvider defaultOpen={!isCollapsed} open={!isCollapsed} onOpenChange={(open) => setIsCollapsed(!open)}>
      <div className="min-h-screen flex w-full">
        <Sidebar collapsible={isMobile ? "offcanvas" : "icon"}>
          <SidebarHeader className="flex justify-between items-center">
            <div className={`flex items-center ${isCollapsed ? 'justify-center' : ''}`}>
              <div className="font-bold text-2xl text-violet-600">StudyTracker</div>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            <nav className="space-y-2 px-2">
              <Link to="/dashboard" className="flex items-center p-3 text-base font-medium rounded-md hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-all">
                <Check className="h-5 w-5 mr-3 text-violet-500" />
                <span>Dashboard</span>
              </Link>
              
              <Link to="/todos" className="flex items-center p-3 text-base font-medium rounded-md hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-all">
                <ListTodo className="h-5 w-5 mr-3 text-violet-500" />
                <span>To-Dos</span>
              </Link>
              
              <Link to="/study-tracker" className="flex items-center p-3 text-base font-medium rounded-md hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-all">
                <Calendar className="h-5 w-5 mr-3 text-violet-500" />
                <span>Study Tracker</span>
              </Link>
              
              <Link to="/friends" className="flex items-center p-3 text-base font-medium rounded-md hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-all">
                <User className="h-5 w-5 mr-3 text-violet-500" />
                <span>Friends</span>
              </Link>
            
              {/* Commented out Library Link */}
              {/* <Link to="/Library" className="flex items-center p-3 text-base font-medium rounded-md hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-all">
                <Book className="h-5 w-5 mr-3 text-violet-500" />  {/ * Changed Icon * /}
                <span>Library</span>
              </Link> */}
              <Link to="/timetable" className="flex items-center p-3 text-base font-medium rounded-md hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-all">
                <Calendar className="h-5 w-5 mr-3 text-violet-500" />
                <span>Time Table</span>
              </Link>
              <Link to="/expenses" className="flex items-center p-3 text-base font-medium rounded-md hover:bg-violet-100 dark:hover:bg-violet-900/20 transition-all">
                <IndianRupee className="h-5 w-5 mr-3 text-violet-500" />
                <span>Expenses</span>
              </Link>
            </nav>
          </SidebarContent>
         
              
          
          <SidebarFooter>
            <div className="p-4">
              {currentUser && (
                <div className="flex flex-col gap-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Signed in as {currentUser.displayName || currentUser.email}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </SidebarFooter>
        </Sidebar>
        
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="md:hidden flex items-center mb-4">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold ml-2 text-violet-600">StudyTracker</h1>
          </div>
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
};

export default AppLayout;
