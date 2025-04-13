
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { recordStudySession, getStudySessions, getUserData } from '@/services/firebase';
import { useToast } from '@/components/ui/use-toast';
import { Calendar, Play, Pause, BarChart } from 'lucide-react';
import { formatDistanceToNow, format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';

const StudyTracker = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [isStudying, setIsStudying] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [studySessions, setStudySessions] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timer');

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      try {
        const sessions = await getStudySessions(currentUser.uid);
        const user = await getUserData(currentUser.uid);
        
        setStudySessions(sessions);
        setUserData(user);
      } catch (error) {
        console.error("Error fetching study data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isStudying && startTime) {
      interval = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isStudying, startTime]);

  const handleStartStudying = () => {
    setIsStudying(true);
    setStartTime(new Date());
    setElapsedTime(0);
    
    toast({
      title: 'Study session started',
      description: 'Your timer has started. Stay focused!',
    });
  };

  const handleStopStudying = async () => {
    if (!currentUser || !startTime) return;

    setIsStudying(false);
    
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    if (durationMinutes < 1) {
      toast({
        title: 'Session too short',
        description: 'Study sessions must be at least 1 minute long to be recorded.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await recordStudySession(currentUser.uid, durationMinutes);
      
      // Refresh study sessions
      const sessions = await getStudySessions(currentUser.uid);
      setStudySessions(sessions);
      
      toast({
        title: 'Study session recorded',
        description: `You studied for ${durationMinutes} minutes. Great job!`,
      });
    } catch (error) {
      toast({
        title: 'Error recording session',
        description: 'There was a problem recording your study session. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate weekly study data
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Start on Monday
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  
  const weeklyData = weekDays.map(day => {
    const dayName = format(day, 'EEE');
    
    const dayTotal = studySessions.reduce((total, session) => {
      if (session.createdAt && isSameDay(session.createdAt.toDate(), day)) {
        return total + (session.duration || 0);
      }
      return total;
    }, 0);
    
    return { day: dayName, minutes: dayTotal };
  });

  // Calculate total study time
  const totalMinutes = userData?.studyTime || 0;
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Study Tracker</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="timer">
            <Play className="h-4 w-4 mr-2" />
            Study Timer
          </TabsTrigger>
          <TabsTrigger value="history">
            <BarChart className="h-4 w-4 mr-2" />
            Study History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="timer" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Study Timer</CardTitle>
                <CardDescription>
                  Focus on your studies and track your time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className="study-timer-container">
                    <div className="text-4xl font-bold tracking-wider">
                      {formatTime(elapsedTime)}
                    </div>
                    
                    <div className="flex space-x-4 mt-6">
                      {!isStudying ? (
                        <Button onClick={handleStartStudying}>
                          <Play className="h-4 w-4 mr-2" />
                          Start Studying
                        </Button>
                      ) : (
                        <Button variant="destructive" onClick={handleStopStudying}>
                          <Pause className="h-4 w-4 mr-2" />
                          End Session
                        </Button>
                      )}
                    </div>
                    
                    {isStudying && (
                      <div className="mt-4 text-sm text-muted-foreground">
                        Started {startTime ? formatDistanceToNow(startTime, { addSuffix: true }) : ''}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-6 text-center">
                    <p className="text-muted-foreground">
                      Remember to take regular breaks for better retention!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>This Week</CardTitle>
                <CardDescription>
                  Your study progress for the current week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end justify-between">
                  {weeklyData.map((day, index) => {
                    const maxHeight = 180; // max bar height in pixels
                    const maxMinutes = Math.max(...weeklyData.map(d => d.minutes), 60); // ensure bars are visible
                    const height = day.minutes > 0 ? Math.max(((day.minutes / maxMinutes) * maxHeight), 20) : 4;
                    
                    return (
                      <div key={index} className="flex flex-col items-center">
                        <div className="text-xs text-muted-foreground mb-1">
                          {day.minutes > 0 ? `${Math.round(day.minutes / 60)}h ${day.minutes % 60}m` : '0'}
                        </div>
                        <div 
                          className={`w-8 rounded-t-md ${day.minutes > 0 ? 'bg-violet-500' : 'bg-muted'} transition-all duration-500`}
                          style={{ height: `${height}px` }}
                        />
                        <div className="mt-2 text-xs font-medium">
                          {day.day}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="history" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Recent Study Sessions</CardTitle>
                <CardDescription>Your latest recorded study periods</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 animate-pulse-soft">
                    Loading study history...
                  </div>
                ) : studySessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No study sessions recorded yet. Use the timer to track your studies!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {studySessions.slice(0, 8).map((session) => (
                      <div key={session.id} className="flex justify-between items-center p-3 border rounded-md">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 mr-3">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {session.duration} minutes
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {session.createdAt ? format(session.createdAt.toDate(), 'PPp') : 'Unknown date'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Study Statistics</CardTitle>
                <CardDescription>Your overall study achievements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-violet-600">
                      {totalHours}{remainingMinutes > 0 ? `.${remainingMinutes}` : ''}
                    </div>
                    <div className="text-muted-foreground">
                      Total hours studied
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold text-violet-600">
                      {studySessions.length}
                    </div>
                    <div className="text-muted-foreground">
                      Total sessions
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-3xl font-bold text-violet-600">
                      {studySessions.length > 0 ? Math.round(totalMinutes / studySessions.length) : 0}
                    </div>
                    <div className="text-muted-foreground">
                      Average minutes per session
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudyTracker;
