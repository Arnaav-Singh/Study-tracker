import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserData,
  sendFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getFriendsData,
  getFriendTodos,
  UserDocument,
  Todo,
  searchUsersById,
  searchUsersByEmail,
  listenForFriendUpdates,
  getTimetable, // Add this import
  TimeSlot     // Add this import
} from '@/services/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Clock, List, ListTodo, Plus, User, X, UserPlus, Loader2, Check, Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { doc, runTransaction, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db } from '@/services/firebase';

interface Friend extends UserDocument {
  weeklyStudyTime?: number;
  uid: string;
}

const Friends = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [friendEmail, setFriendEmail] = useState('');
  const [friendUid, setFriendUid] = useState('');
  const [userData, setUserData] = useState<Friend | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [selectedFriendTodos, setSelectedFriendTodos] = useState<Todo[]>([]);
  const [selectedFriendTimetable, setSelectedFriendTimetable] = useState<TimeSlot[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loadingFriendTodos, setLoadingFriendTodos] = useState(false);
  const [loadingFriendTimetable, setLoadingFriendTimetable] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [error, setError] = useState<string | null>(null); // State for general errors

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = await getUserData(currentUser.uid);
        if (user) {
          setUserData(user as Friend);
        } else {
          setError('Failed to fetch user data.'); // Set error if getUserData fails
          return;
        }

        const friendsData = await getFriendsData(currentUser.uid);
        setFriends(friendsData as Friend[]);

        if (user?.friendRequests && user.friendRequests.length > 0) {
          const requests = await Promise.all(
            user.friendRequests.map(async (id: string) => {
              try {
                return await getUserData(id);
              } catch (e) {
                console.error(`Failed to fetch friend request user data for id ${id}:`, e);
                return null; // Important: return null for failed fetches
              }
            })
          );
          // Filter out null results (failed fetches) to prevent errors
          setFriendRequests(requests.filter((request) => request !== null) as UserDocument[]);
        } else {
          setFriendRequests([]);
        }
      } catch (error: any) {
        console.error('Error fetching friends data:', error);
        setError(error.message || 'Failed to load friends data. Please try again later.'); // Set error
        toast({
          title: 'Error',
          description: error.message || 'Failed to load friends data. Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const unsubscribe = listenForFriendUpdates(currentUser.uid, async (friendIds) => {
      try {
        const updatedFriends = await getFriendsData(currentUser.uid);
        setFriends(updatedFriends as Friend[]);
      } catch (error) {
        console.error('Error updating friends list:', error);
        toast({
          title: 'Error',
          description: 'Failed to update friends list.',
          variant: 'destructive'
        })
      }
    });

    return () => unsubscribe();
  }, [currentUser, toast]);

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || (!friendEmail.trim() && !friendUid.trim()) || isSendingRequest) {
      toast({
        title: 'Error',
        description: 'Please enter either friend email or Friend UID.',
        variant: 'destructive',
      });
      return;
    }

    if (friendEmail.toLowerCase() === currentUser.email?.toLowerCase()) {
      toast({
        title: 'Invalid email',
        description: 'You cannot add yourself as a friend.',
        variant: 'destructive',
      });
      return;
    }

    setIsSendingRequest(true);
    setError(null);
    try {
      let receiverId: string;
      if (friendUid.trim()) {
        const users = await searchUsersById([friendUid]);
        if (users.length === 0) {
          throw new Error('User with this UID not found');
        }
        receiverId = users[0].uid;
      } else {
        const users = await searchUsersByEmail(friendEmail);
        if (users.length === 0) {
          throw new Error('User with this email not found');
        }
        receiverId = users[0].id;
      }

      await sendFriendRequest(currentUser.uid, receiverId);
      toast({
        title: 'Friend request sent',
        description: 'Your friend request has been sent successfully.',
      });
      setFriendEmail('');
      setFriendUid('');
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      setError(error.message || 'There was a problem sending your friend request. Please try again.'); // Set error
      toast({
        title: 'Error sending friend request',
        description: error.message || 'There was a problem sending your friend request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleAcceptFriendRequest = async (friendId: string) => {
    if (!currentUser || acceptingRequestId === friendId) return;
    setAcceptingRequestId(friendId);
    setError(null);
    try {
      const receiverId = currentUser.uid;
      const senderId = friendId;

      const receiverRef = doc(db, 'users', receiverId);
      const senderRef = doc(db, 'users', senderId);

      await runTransaction(db, async (transaction) => {
        const receiverDoc = await transaction.get(receiverRef);
        const senderDoc = await transaction.get(senderRef);

        if (!receiverDoc.exists()) throw new Error("Receiver user document does not exist!");
        if (!senderDoc.exists()) throw new Error("Sender user document does not exist!");

        const receiverData = receiverDoc.data() as UserDocument;
        if (!receiverData.friendRequests?.includes(senderId)) {
          throw new Error("Sender is not in receiver's friend requests.");
        }

        transaction.update(receiverRef, {
          friendRequests: arrayRemove(senderId),
          friends: arrayUnion(senderId),
        });
        transaction.update(senderRef, {
          friends: arrayUnion(receiverId),
        });
      });

      toast({ title: 'Friend request accepted', description: 'You are now friends!' });
      setFriendRequests(prev => prev.filter(req => req.id !== senderId));
    } catch (error: any) {
      console.error('Error accepting friend request:', error);
      setError(error.message || 'Failed to accept. Please try again.'); // Set error
      toast({
        title: 'Error accepting friend request',
        description: error.message || 'Failed to accept. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAcceptingRequestId(null);
    }
  };

  const handleRejectFriendRequest = async (friendId: string) => {
    if (!currentUser || rejectingRequestId === friendId) return;
    setRejectingRequestId(friendId);
    setError(null);
    try {
      await rejectFriendRequest(currentUser.uid, friendId);
      setFriendRequests((prev) => prev.filter((request) => request?.id !== friendId));
      toast({ title: 'Friend request rejected', description: 'The friend request has been rejected.' });
    } catch (error: any) {
      console.error('Error rejecting friend request:', error);
      setError(error.message || 'Failed to reject. Please try again.'); // Set error
      toast({
        title: 'Error rejecting friend request',
        description: error.message || 'Failed to reject. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRejectingRequestId(null);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!currentUser || removingFriendId === friendId) return;
    setRemovingFriendId(friendId);
    setError(null);
    try {
      await removeFriend(currentUser.uid, friendId);
      setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
      toast({ title: 'Friend removed', description: 'The friend has been removed from your friends list.' });
    } catch (error: any) {
      console.error('Error removing friend:', error);
      setError(error.message || 'Failed to remove friend. Please try again.'); // Set error
      toast({
        title: 'Error removing friend',
        description: error.message || 'Failed to remove friend. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setRemovingFriendId(null);
    }
  };

  const handleViewFriendDetails = async (friend: Friend) => {
    setSelectedFriend(friend);
    setIsDialogOpen(true);
    setLoadingFriendTodos(true);
    setLoadingFriendTimetable(true);
    setShowTimetable(false); // Reset timetable view
    setError(null);

    try {
      const [todos, timetable] = await Promise.all([
        getFriendTodos(friend.id),
        getTimetable(friend.id)
      ]);
      setSelectedFriendTodos(todos);
      setSelectedFriendTimetable(timetable);
    } catch (error: any) {
      console.error('Error fetching friend details:', error);
      setError(error.message || "There was a problem fetching your friend's details."); // Set error
      toast({
        title: 'Error',
        description: error.message || "There was a problem fetching your friend's details.",
        variant: 'destructive',
      });
      setSelectedFriendTodos([]);
      setSelectedFriendTimetable([]);
    } finally {
      setLoadingFriendTodos(false);
      setLoadingFriendTimetable(false);
    }
  };

  const handleViewTimetable = () => {
    setShowTimetable(true);
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Friends</h1>
        {userData && (
          <div className="text-sm text-muted-foreground">
            Your UID: <span className="font-mono text-violet-500">{userData.uid}</span>
          </div>
        )}
      </div>
      {error && (
        <Card className="border-red-500 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-red-500 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Error
            </CardTitle>
            <CardDescription className="text-red-400">{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="friends">
            <User className="h-4 w-4 mr-2" />
            My Friends
          </TabsTrigger>
          <TabsTrigger value="requests">
            <UserPlus className="h-4 w-4 mr-2" />
            Friend Requests {friendRequests.length > 0 && `(${friendRequests.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Add a Friend</CardTitle>
              <CardDescription>Connect with friends to see their study progress</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSendFriendRequest} className="flex space-x-2 flex-wrap items-end gap-2">
                <Input
                  placeholder="friend@example.com"
                  type="email"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                <Input
                  placeholder="Friend UID"
                  type="text"
                  value={friendUid}
                  onChange={(e) => setFriendUid(e.target.value)}
                  className="flex-1 min-w-[150px]"
                />
                <Button type="submit" size="sm" disabled={isSendingRequest} className="min-w-[100px]">
                  {isSendingRequest ? (
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-2">
                You can add friends using their email or their unique Friend UID.
              </p>
            </CardContent>
          </Card>

          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-4">My Friends</h2>
            {loading ? (
              <div className="text-center py-8 animate-pulse-soft">Loading friends...</div>
            ) : friends.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                You haven't added any friends yet. Add a friend to track their progress!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {friends.map((friend) => (
                  <Card key={friend.id} className="friend-card">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 mr-3">
                            {friend.displayName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div className="font-medium">{friend.displayName}</div>
                            <div className="text-sm text-muted-foreground">{friend.email}</div>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between items-center text-sm">
                          <span>Weekly study time:</span>
                          <span className="font-medium">
                            {friend.weeklyStudyTime !== undefined ? Math.round(friend.weeklyStudyTime / 60) : 'N/A'} hours
                          </span>
                        </div>
                        <Progress
                          value={
                            friend.weeklyStudyTime !== undefined
                              ? Math.min((friend.weeklyStudyTime / (7 * 24 * 60 * 60)) * 100, 100)
                              : 0
                          }
                          className="h-2 mt-2"
                        />
                      </div>
                      <div className="mt-4 flex justify-between">
                        <Button variant="outline" size="sm" onClick={() => handleViewFriendDetails(friend)}>
                          View Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFriend(friend.id)}
                          disabled={removingFriendId === friend.id}
                        >
                          {removingFriendId === friend.id ? (
                            <Loader2 className="animate-spin h-4 w-4 mr-1" />
                          ) : (
                            <X className="h-4 w-4 mr-1" />
                          )}
                          Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Friend Requests</CardTitle>
              <CardDescription>Manage your incoming friend requests</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 animate-pulse-soft">Loading requests...</div>
              ) : friendRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  You don't have any friend requests.
                </div>
              ) : (
                <div className="space-y-4">
                  {friendRequests.map((request) => (
                    <div key={request.id} className="flex justify-between items-center p-4 border rounded-md">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 mr-3">
                          {request.displayName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-medium">{request.displayName}</div>
                          <div className="text-sm text-muted-foreground">{request.email}</div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptFriendRequest(request.id)}
                          disabled={acceptingRequestId === request.id}
                        >
                          {acceptingRequestId === request.id ? (
                            <Loader2 className="animate-spin h-4 w-4 mr-2" />
                          ) : (
                            'Accept'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRejectFriendRequest(request.id)}
                          disabled={rejectingRequestId === request.id}
                        >
                          {rejectingRequestId === request.id ? (
                            <Loader2 className="animate-spin h-4 w-4 mr-2" />
                          ) : (
                            'Decline'
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedFriend && (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{selectedFriend.displayName}'s Progress</DialogTitle>
              <DialogDescription>View your friend&apos;s study progress and tasks</DialogDescription>
            </DialogHeader>
            {error && (
              <Card className="border-red-500 bg-red-50/50 my-4">
                <CardHeader>
                  <CardTitle className="text-red-500 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Error
                  </CardTitle>
                  <CardDescription className="text-red-400">{error}</CardDescription>
                </CardHeader>
              </Card>
            )}
            <div className="space-y-6 py-4">
              {!showTimetable ? (
                <>
                  <div className="space-y-2">
                    <h3 className="font-medium flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-violet-500" />
                      Study Stats
                    </h3>
                    <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-md">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-violet-600">
                          {selectedFriend.weeklyStudyTime !== undefined ? Math.round(selectedFriend.weeklyStudyTime / 60) : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">Hours this week</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-violet-600">
                          {selectedFriend.studyTime !== undefined ? Math.round(selectedFriend.studyTime / 60) : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">Total hours</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium flex items-center">
                      <ListTodo className="h-4 w-4 mr-2 text-violet-500" />
                      Recent Tasks
                    </h3>
                    {loadingFriendTodos ? (
                      <div className="text-center py-4">
                        <Loader2 className="animate-spin h-6 w-6 text-violet-500 mx-auto" />
                        <div className="text-sm text-muted-foreground mt-2">Loading tasks...</div>
                      </div>
                    ) : selectedFriendTodos.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">No tasks found</div>
                    ) : (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {selectedFriendTodos.slice(0, 5).map((todo) => (
                          <div key={todo.id} className="flex items-start p-2 rounded-md border">
                            <div
                              className={`mr-2 mt-0.5 ${todo.completed ? 'text-green-500' : 'text-muted-foreground'}`}
                            >
                              {todo.completed ? <Check size={14} /> : <List size={14} />}
                            </div>
                            <div className="flex-1">
                              <div className={`text-sm ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                                {todo.task}
                              </div>
                              {todo.createdAt && (
                                <div className="text-xs text-muted-foreground">
                                  {format(todo.createdAt.toDate(), 'PPp')}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" onClick={handleViewTimetable}>
                    <Calendar className="h-4 w-4 mr-2" />
                    View Timetable
                  </Button>
                </>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-2 text-violet-500" />
                    Timetable
                  </h3>
                  {loadingFriendTimetable ? (
                    <div className="text-center py-4">
                      <Loader2 className="animate-spin h-6 w-6 text-violet-500 mx-auto" />
                      <div className="text-sm text-muted-foreground mt-2">Loading timetable...</div>
                    </div>
                  ) : selectedFriendTimetable.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No timetable entries found
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto">
                      {daysOfWeek.map(day => {
                        const daySlots = selectedFriendTimetable
                          .filter(slot => slot.day === day)
                          .sort((a, b) => a.startTime.localeCompare(b.startTime));
                        if (daySlots.length === 0) return null;
                        return (
                          <div key={day}>
                            <h4 className="font-semibold">{day}</h4>
                            {daySlots.map(slot => (
                              <div key={slot.id} className="p-2 border rounded-md mt-2">
                                <div className="text-sm">
                                  {slot.startTime} - {slot.endTime}
                                </div>
                                <div className="text-sm font-medium">{slot.subject}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Button variant="outline" onClick={() => setShowTimetable(false)}>
                    Back to Details
                  </Button>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Friends;

