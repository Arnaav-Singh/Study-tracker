
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import TimeTable from "./pages/TimeTable"; 
import Dashboard from "./pages/Dashboard";
import TodoList from "./pages/TodoList";
import StudyTracker from "./pages/StudyTracker";
import Friends from "./pages/Friends";
import NotFound from "./pages/NotFound";
import Library from "./pages/Library";
import ExpenseTracker from "./pages/ExpenseTracker";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            
            
            <Route 
              path="/" 
              element={<Navigate to="/dashboard" replace />} 
            />
            
            <Route 
              path="/" 
              element={
                <PrivateRoute>
                  <AppLayout />
                </PrivateRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/todos" element={<TodoList />} />
              <Route path="/study-tracker" element={<StudyTracker />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/library" element={<Library />} />
              <Route path="/timetable" element={<TimeTable />} />
              <Route path="/expenses" element={<ExpenseTracker />} />
            </Route>
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
