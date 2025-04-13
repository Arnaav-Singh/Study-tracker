import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { getUserData, getWeeklyStudyTime, getTodos, getFriendsData } from '@/services/firebase';
import { ArrowUp, Calendar, Check, ListTodo, Plus, User } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LeaderboardUser {
  id?: string;
  displayName?: string | null;
  weeklyStudyTime: number;
}

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [userData, setUserData] = useState<any>(null);
  const [weeklyStudyTime, setWeeklyStudyTime] = useState(0);
  const [todos, setTodos] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (currentUser) {
        try {
          const user = await getUserData(currentUser.uid);
          const weekly = await getWeeklyStudyTime(currentUser.uid);
          const userTodos = await getTodos(currentUser.uid);
          const userFriends = await getFriendsData(currentUser.uid);

          setUserData(user);
          setWeeklyStudyTime(weekly);
          setTodos(userTodos.slice(0, 5)); // Show only 5 most recent todos
          setFriends(userFriends.slice(0, 3)); // Show only 3 friends
        } catch (error) {
          console.error("Error fetching dashboard data:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [currentUser]);

  // Calculate progress towards weekly goal (assuming 1000 minutes weekly goal)
  const weeklyGoal = 1000; // 16.67 hours per week
  const progress = Math.min(Math.round((weeklyStudyTime / weeklyGoal) * 100), 100);

  const leaderboardData: LeaderboardUser[] = [...friends, { id: currentUser?.uid, displayName: userData?.displayName || "You", weeklyStudyTime }]
    .sort((a, b) => b.weeklyStudyTime - a.weeklyStudyTime)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-pulse-soft text-2xl font-semibold text-violet-600">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold">
          Hello, {userData?.displayName || currentUser?.displayName || "Friend"}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Weekly Study Progress</CardTitle>
            <CardDescription>Tracking your weekly study hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-3xl font-bold">{Math.round(weeklyStudyTime / 60)}</span>
                  <span className="text-muted-foreground ml-1">hours</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Goal: {Math.round(weeklyGoal / 60)} hours
                </div>
              </div>

              <Progress value={progress} className="h-2" />

              <div className="text-center">
                <Link to="/study-tracker">
                  <Button variant="outline" size="sm" className="mt-2">
                    <Calendar className="mr-2 h-4 w-4" />
                    Start Studying
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Recent Tasks</CardTitle>
            <CardDescription>Your latest to-do items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {todos.length > 0 ? (
                <ul className="space-y-2">
                  {todos.slice(0, 3).map((todo) => (
                    <li key={todo.id} className="flex items-start">
                      <div className={`mr-2 mt-0.5 ${todo.completed ? 'text-green-500' : 'text-muted-foreground'}`}>
                        <Check size={16} />
                      </div>
                      <span className={`text-sm ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {todo.task}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No tasks yet
                </div>
              )}

              <div className="text-center">
                <Link to="/todos">
                  <Button variant="outline" size="sm" className="mt-2">
                    <ListTodo className="mr-2 h-4 w-4" />
                    View All Tasks
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium">Friends Activity</CardTitle>
            <CardDescription>See how your friends are doing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {friends.length > 0 ? (
                <ul className="space-y-3">
                  {friends.map((friend) => (
                    <li key={friend.id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 mr-2">
                          {friend.displayName?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <span className="text-sm font-medium">{friend.displayName}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(friend.weeklyStudyTime / 60)}h this week
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No friends yet
                </div>
              )}

              <div className="text-center">
                <Link to="/friends">
                  <Button variant="outline" size="sm" className="mt-2">
                    <User className="mr-2 h-4 w-4" />
                    Manage Friends
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">Weekly Leaderboard</CardTitle>
          <CardDescription>Compare your study time with friends</CardDescription>
        </CardHeader>
        <CardContent>
          {friends.length > 0 ? (
            <div className="relative pt-8 min-w-[300px] flex justify-around items-end">
              {leaderboardData.map((user, index) => {
                const isCurrentUser = user.id === currentUser?.uid;
                const maxHeight = 120; // max bar height in pixels
                const maxStudyTime = Math.max(...leaderboardData.map((u) => u.weeklyStudyTime), 1);
                const barHeight = (user.weeklyStudyTime / maxStudyTime) * maxHeight;
                const totalMinutes = user.weeklyStudyTime;
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;

                return (
                  <div
                    key={user.id}
                    className="flex flex-col items-center relative"
                    style={{ marginBottom: '20px' }}
                    onMouseEnter={() => setHoveredUser(user.id || 'you')}
                    onMouseLeave={() => setHoveredUser(null)}
                  >
                    <div className="relative flex justify-center items-end w-12 md:w-16">
                      <div
                        className={`rounded-t-md transition-all duration-300 ${
                          isCurrentUser ? 'bg-violet-500' : 'bg-indigo-300'
                        } ${hoveredUser === user.id || (isCurrentUser && hoveredUser === 'you') ? 'opacity-100' : 'opacity-80'}`}
                        style={{ height: `${barHeight}px`, width: '100%' }}
                      />
                      <div
                        className={`absolute bottom-[${barHeight}px] text-xs md:text-sm font-medium text-center -translate-y-2 ${
                          hoveredUser === user.id || (isCurrentUser && hoveredUser === 'you') ? 'opacity-100' : 'opacity-0'
                        } transition-opacity duration-300`}
                      >
                        {hours}h {minutes}m
                      </div>
                      {index === 0 && (
                        <div className="absolute -top-5 text-yellow-500 font-bold">👑</div>
                      )}
                    </div>
                    <div className="mt-2 text-xs md:text-sm font-medium text-center truncate w-12 md:w-16">
                      {isCurrentUser ? "You" : user.displayName?.split(' ')[0]}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Add friends to see the leaderboard
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
