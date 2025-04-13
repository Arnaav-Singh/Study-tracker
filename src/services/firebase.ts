import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  orderBy,
  limit,
  arrayUnion,
  arrayRemove,
  DocumentData,
  FirestoreDataConverter,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// Firebase configuration (move to .env for production)
const firebaseConfig = {
  apiKey: "AIzaSyAOFZrM7ArDhFJC1NcruJsmrDqEU2mVmSk",
  authDomain: "study-tracker-6203e.firebaseapp.com",
  projectId: "study-tracker-6203e",
  storageBucket: "study-tracker-6203e.appspot.com",
  messagingSenderId: "517475969826",
  appId: "1:517475969826:web:46818350363c122038937b",
  measurementId: "G-F9BH1ZCG3K",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-south1'); // Match your region

// --- Type Definitions and Data Converters ---

interface UserDocument {
  id?: string;
  uid: string;
  email?: string;
  displayName?: string;
  studyTime?: number;
  weeklyStudyTime?: number;
  friends?: string[];
  friendRequests?: string[];
  createdAt?: any;
}

interface Todo {
  id?: string;
  userId: string;
  task: string;
  completed: boolean;
  createdAt?: any;
}

interface LibraryItem {
  id?: string;
  userId: string;
  title: string;
  googleDriveFileId: string;
  createdAt?: any;
}

interface TimeSlot {
  id?: string;
  userId: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  createdAt?: any;
}

interface Expense {
  id?: string;
  userId: string;
  amount: number;
  category: string;
  description: string;
  date: Timestamp;
  createdAt?: Timestamp;
  transactionType: 'credit' | 'debit'; // Added to match ExpenseTracker
}

// Student expense categories
export const EXPENSE_CATEGORIES = [
  'Books & Supplies',
  'Tuition & Fees',
  'Food',
  'Housing',
  'Transportation',
  'Entertainment',
  'Technology',
  'Health',
  'Clothing',
  'Other',
];

const userConverter: FirestoreDataConverter<UserDocument> = {
  toFirestore: (user: UserDocument): DocumentData => ({
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    studyTime: user.studyTime || 0,
    weeklyStudyTime: user.weeklyStudyTime || 0,
    friends: user.friends || [],
    friendRequests: user.friendRequests || [],
    createdAt: user.createdAt || serverTimestamp(),
  }),
  fromFirestore: (snapshot, options): UserDocument => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      uid: data.uid,
      email: data.email || '',
      displayName: data.displayName || '',
      studyTime: data.studyTime || 0,
      weeklyStudyTime: data.weeklyStudyTime || 0,
      friends: data.friends || [],
      friendRequests: data.friendRequests || [],
      createdAt: data.createdAt,
    };
  },
};

const todoConverter: FirestoreDataConverter<Todo> = {
  toFirestore: (todo: Todo): DocumentData => ({
    userId: todo.userId,
    task: todo.task,
    completed: todo.completed,
    createdAt: todo.createdAt || serverTimestamp(),
  }),
  fromFirestore: (snapshot, options): Todo => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: data.userId,
      task: data.task,
      completed: data.completed,
      createdAt: data.createdAt,
    };
  },
};

const libraryConverter: FirestoreDataConverter<LibraryItem> = {
  toFirestore: (item: LibraryItem): DocumentData => ({
    userId: item.userId,
    title: item.title,
    googleDriveFileId: item.googleDriveFileId,
    createdAt: item.createdAt || serverTimestamp(),
  }),
  fromFirestore: (snapshot, options): LibraryItem => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: data.userId,
      title: data.title,
      googleDriveFileId: data.googleDriveFileId,
      createdAt: data.createdAt,
    };
  },
};

const timetableConverter: FirestoreDataConverter<TimeSlot> = {
  toFirestore: (slot: TimeSlot): DocumentData => ({
    userId: slot.userId,
    day: slot.day,
    startTime: slot.startTime,
    endTime: slot.endTime,
    subject: slot.subject,
    createdAt: slot.createdAt || serverTimestamp(),
  }),
  fromFirestore: (snapshot, options): TimeSlot => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: data.userId,
      day: data.day,
      startTime: data.startTime,
      endTime: data.endTime,
      subject: data.subject,
      createdAt: data.createdAt,
    };
  },
};

const expenseConverter: FirestoreDataConverter<Expense> = {
  toFirestore: (expense: Expense): DocumentData => ({
    userId: expense.userId,
    amount: expense.amount,
    category: expense.category,
    description: expense.description,
    date: expense.date,
    createdAt: expense.createdAt || serverTimestamp(),
    transactionType: expense.transactionType,
  }),
  fromFirestore: (snapshot, options): Expense => {
    const data = snapshot.data(options);
    return {
      id: snapshot.id,
      userId: data.userId,
      amount: data.amount,
      category: data.category,
      description: data.description,
      date: data.date,
      createdAt: data.createdAt,
      transactionType: data.transactionType || 'debit', // Default to 'debit' for backward compatibility
    };
  },
};

// --- Authentication Functions ---

export const signIn = async (email: string, password: string): Promise<User> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Sign-in error:', error.message, error.code);
    throw error;
  }
};

export const signInWithGoogle = async (): Promise<User> => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, 'users', user.uid).withConverter(userConverter);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        studyTime: 0,
        weeklyStudyTime: 0,
        friends: [],
        friendRequests: [],
        createdAt: serverTimestamp(),
      });
    }

    return user;
  } catch (error: any) {
    console.error('Google sign-in error:', error.message, error.code);
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Sign-out error:', error.message, error.code);
    throw error;
  }
};

// --- Firestore Functions ---

export const createUserDocument = async (userId: string, data: Omit<UserDocument, 'id'>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId).withConverter(userConverter);
    await setDoc(userRef, data, { merge: true });
  } catch (error: any) {
    console.error('Error creating user document:', error.message, error.code);
    throw error;
  }
};

export const getUserData = async (userId: string): Promise<UserDocument | null> => {
  try {
    const userRef = doc(db, 'users', userId).withConverter(userConverter);
    const docSnap = await getDoc(userRef);
    return docSnap.exists() ? docSnap.data() : null;
  } catch (error: any) {
    console.error('Error getting user data:', error.message, error.code);
    throw error;
  }
};

export const updateUserData = async (userId: string, data: Partial<UserDocument>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId).withConverter(userConverter);
    await updateDoc(userRef, data);
  } catch (error: any) {
    console.error('Error updating user data:', error.message, error.code);
    throw error;
  }
};

// --- Todo Functions ---

export const getTodos = async (userId: string): Promise<Todo[]> => {
  try {
    const todosRef = collection(db, 'todos').withConverter(todoConverter);
    const q = query(todosRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data());
  } catch (error: any) {
    console.error('Error getting todos:', error.message, error.code);
    throw error;
  }
};

export const subscribeToTodos = (userId: string, callback: (todos: Todo[]) => void): (() => void) => {
  const todosRef = collection(db, 'todos').withConverter(todoConverter);
  const q = query(todosRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (querySnapshot) => callback(querySnapshot.docs.map((doc) => doc.data())),
    (error) => {
      console.error('Error fetching todos:', error);
      callback([]);
    }
  );
};

export const addTodo = async (userId: string, task: string): Promise<void> => {
  try {
    const todosRef = collection(db, 'todos').withConverter(todoConverter);
    await addDoc(todosRef, { userId, task, completed: false, createdAt: serverTimestamp() });
  } catch (error: any) {
    console.error('Error adding todo:', error.message, error.code);
    throw error;
  }
};

export const updateTodo = async (todoId: string, updates: Partial<Todo>): Promise<void> => {
  try {
    const todoRef = doc(db, 'todos', todoId).withConverter(todoConverter);
    await updateDoc(todoRef, updates);
  } catch (error: any) {
    console.error('Error updating todo:', error.message, error.code);
    throw error;
  }
};

export const deleteTodo = async (todoId: string): Promise<void> => {
  try {
    const todoRef = doc(db, 'todos', todoId);
    await deleteDoc(todoRef);
  } catch (error: any) {
    console.error('Error deleting todo:', error.message, error.code);
    throw error;
  }
};

// --- Study Session Functions ---

export const getStudySessions = async (userId: string): Promise<DocumentData[]> => {
  try {
    const studySessionsRef = collection(db, 'studySessions');
    const q = query(studySessionsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(20));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error: any) {
    console.error('Error getting study sessions:', error.message, error.code);
    throw error;
  }
};

export const recordStudySession = async (userId: string, durationMinutes: number): Promise<void> => {
  try {
    const now = new Date();
    await addStudySession(userId, now, null, durationMinutes);
    const userRef = doc(db, 'users', userId).withConverter(userConverter);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentStudyTime = userData.studyTime || 0;
      await updateDoc(userRef, { studyTime: currentStudyTime + durationMinutes });
    }
  } catch (error: any) {
    console.error('Error recording study session:', error.message, error.code);
    throw error;
  }
};

export const getWeeklyStudyTime = async (userId: string): Promise<number> => {
  try {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);
    const studySessionsRef = collection(db, 'studySessions');
    const q = query(studySessionsRef, where('userId', '==', userId), where('createdAt', '>=', startOfWeek));
    const querySnapshot = await getDocs(q);
    let totalMinutes = 0;
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.duration) {
        totalMinutes += data.duration;
      } else {
        const startTime = data.startTime?.toDate();
        const endTime = data.endTime?.toDate() || new Date();
        if (startTime && endTime) {
          totalMinutes += Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        }
      }
    });
    return totalMinutes;
  } catch (error: any) {
    console.error('Error getting weekly study time:', error.message, error.code);
    throw error;
  }
};

const addStudySession = async (
  userId: string,
  startTime: Date,
  endTime: Date | null,
  duration: number | null = null
): Promise<void> => {
  try {
    const studySessionsRef = collection(db, 'studySessions');
    await addDoc(studySessionsRef, { userId, startTime, endTime, duration, createdAt: serverTimestamp() });
  } catch (error: any) {
    console.error('Error adding study session:', error.message, error.code);
    throw error;
  }
};

// --- Friend Functions ---

export const searchUsersById = async (userIds: string[]): Promise<UserDocument[]> => {
  try {
    if (userIds.length === 0) return [];
    const usersRef = collection(db, 'users').withConverter(userConverter);
    const q = query(usersRef, where('uid', 'in', userIds));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data());
  } catch (error: any) {
    console.error('Error searching users by ID:', error.message, error.code);
    throw error;
  }
};

export const searchUsers = async (queryStr: string, currentUserId: string | null): Promise<UserDocument[]> => {
  try {
    const usersRef = collection(db, 'users').withConverter(userConverter);
    const q = query(usersRef);
    const querySnapshot = await getDocs(q);
    let currentUserFriends: string[] = [];
    if (currentUserId) {
      const currentUserData = await getUserData(currentUserId);
      currentUserFriends = currentUserData?.friends || [];
    }
    const filteredUsers = querySnapshot.docs
      .map((doc) => doc.data())
      .filter((user) => {
        if (user.uid === currentUserId) return false;
        const queryLower = queryStr.toLowerCase();
        const email = (user.email || '').toLowerCase();
        const displayName = (user.displayName || '').toLowerCase();
        return email.includes(queryLower) || displayName.includes(queryLower);
      });
    return filteredUsers.map((user) => ({ ...user, isFriend: currentUserFriends.includes(user.uid) }));
  } catch (error: any) {
    console.error('Error searching users:', error.message, error.code);
    return [];
  }
};

export const searchUsersByEmail = async (email: string): Promise<UserDocument[]> => {
  try {
    const usersRef = collection(db, 'users').withConverter(userConverter);
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data());
  } catch (error: any) {
    console.error('Error searching users by email:', error.message, error.code);
    return [];
  }
};

export const getFriendsData = async (userId: string): Promise<UserDocument[]> => {
  try {
    const userRef = doc(db, 'users', userId).withConverter(userConverter);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const friendIds = userData.friends || [];
      if (friendIds.length === 0) return [];
      const friendsData = await searchUsersById(friendIds);
      return Promise.all(
        friendsData.map(async (friend) => {
          const weeklyStudyTime = await getWeeklyStudyTime(friend.uid);
          return { ...friend, weeklyStudyTime };
        })
      );
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching friends data:', error.message, error.code);
    return [];
  }
};

export const addFriend = async (userId: string, friendId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId).withConverter(userConverter);
    await updateDoc(userRef, { friends: arrayUnion(friendId) });
  } catch (error: any) {
    console.error('Error adding friend:', error.message, error.code);
    throw error;
  }
};

export const removeFriend = async (userId: string, friendId: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId).withConverter(userConverter);
    await updateDoc(userRef, { friends: arrayRemove(friendId) });
  } catch (error: any) {
    console.error('Error removing friend:', error.message, error.code);
    throw error;
  }
};

// --- Friend Request Functions ---

export const sendFriendRequest = async (senderId: string, receiverId: string): Promise<void> => {
  try {
    if (!auth.currentUser || auth.currentUser.uid !== senderId) {
      throw new Error('User not authenticated or sender ID mismatch');
    }
    const receiverRef = doc(db, 'users', receiverId).withConverter(userConverter);
    const receiverSnap = await getDoc(receiverRef);
    if (!receiverSnap.exists()) throw new Error('Receiver document does not exist');
    await updateDoc(receiverRef, { friendRequests: arrayUnion(senderId) });
  } catch (error: any) {
    console.error('Error sending friend request:', error.message, error.code);
    throw error;
  }
};

export const acceptFriendRequest = async (receiverId: string, senderId: string): Promise<void> => {
  try {
    const receiverRef = doc(db, 'users', receiverId).withConverter(userConverter);
    const senderRef = doc(db, 'users', senderId).withConverter(userConverter);
    await updateDoc(receiverRef, { friends: arrayUnion(senderId), friendRequests: arrayRemove(senderId) });
    await updateDoc(senderRef, { friends: arrayUnion(receiverId) });
  } catch (error: any) {
    console.error('Error accepting friend request:', error.message, error.code);
    throw error;
  }
};

export const rejectFriendRequest = async (receiverId: string, senderId: string): Promise<void> => {
  try {
    const receiverRef = doc(db, 'users', receiverId).withConverter(userConverter);
    await updateDoc(receiverRef, { friendRequests: arrayRemove(senderId) });
  } catch (error: any) {
    console.error('Error rejecting friend request:', error.message, error.code);
    throw error;
  }
};

// --- Friend Todo Functions ---

export const getFriendTodos = async (userId: string): Promise<Todo[]> => {
  try {
    const todosRef = collection(db, 'todos').withConverter(todoConverter);
    const q = query(todosRef, where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(5));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data());
  } catch (error: any) {
    console.error('Error fetching friend todos:', error.message, error.code);
    throw error;
  }
};

// --- Listen For Friend Updates ---

export const listenForFriendUpdates = (userId: string, callback: (friends: string[]) => void): (() => void) => {
  const userRef = doc(db, 'users', userId).withConverter(userConverter);
  return onSnapshot(
    userRef,
    (doc) => {
      if (doc.exists()) callback(doc.data().friends || []);
      else callback([]);
    },
    (error) => console.error('Error in listenForFriendUpdates', error)
  );
};


// --- Timetable Functions ---

export const getTimetable = async (userId: string): Promise<TimeSlot[]> => {
  try {
    const timetableRef = collection(db, 'timetable').withConverter(timetableConverter);
    const q = query(timetableRef, where('userId', '==', userId), orderBy('day'), orderBy('startTime'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data());
  } catch (error: any) {
    console.error('Error getting timetable:', error.message, error.code);
    throw error;
  }
};

export const subscribeToTimetable = (userId: string, callback: (slots: TimeSlot[]) => void): (() => void) => {
  const timetableRef = collection(db, 'timetable').withConverter(timetableConverter);
  const q = query(timetableRef, where('userId', '==', userId), orderBy('day'), orderBy('startTime'));
  return onSnapshot(
    q,
    (querySnapshot) => callback(querySnapshot.docs.map((doc) => doc.data())),
    (error) => {
      console.error('Error fetching timetable:', error);
      callback([]);
    }
  );
};

export const addTimeSlot = async (userId: string, slot: Omit<TimeSlot, 'id' | 'userId' | 'createdAt'>): Promise<void> => {
  try {
    const timetableRef = collection(db, 'timetable').withConverter(timetableConverter);
    await addDoc(timetableRef, {
      userId,
      ...slot,
      createdAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error adding time slot:', error.message, error.code);
    throw error;
  }
};

export const updateTimeSlot = async (slotId: string, updates: Partial<TimeSlot>): Promise<void> => {
  try {
    const slotRef = doc(db, 'timetable', slotId).withConverter(timetableConverter);
    await updateDoc(slotRef, updates);
  } catch (error: any) {
    console.error('Error updating time slot:', error.message, error.code);
    throw error;
  }
};

export const deleteTimeSlot = async (slotId: string): Promise<void> => {
  try {
    const slotRef = doc(db, 'timetable', slotId);
    await deleteDoc(slotRef);
  } catch (error: any) {
    console.error('Error deleting time slot:', error.message, error.code);
    throw error;
  }
};

// --- Expense Functions ---

export const getExpenses = async (userId: string): Promise<Expense[]> => {
  try {
    const expensesRef = collection(db, 'expenses').withConverter(expenseConverter);
    const q = query(expensesRef, where('userId', '==', userId), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data());
  } catch (error: any) {
    console.error('Error fetching expenses:', error.message, error.code);
    throw error;
  }
};

export const addExpense = async (
  userId: string,
  amount: number,
  category: string,
  description: string,
  date: Date,
  transactionType: 'credit' | 'debit'
): Promise<string> => {
  try {
    const expensesRef = collection(db, 'expenses').withConverter(expenseConverter);
    const docRef = await addDoc(expensesRef, {
      userId,
      amount,
      category,
      description,
      date: Timestamp.fromDate(date),
      createdAt: serverTimestamp(),
      transactionType,
    });
    return docRef.id;
  } catch (error: any) {
    console.error('Error adding expense:', error.message, error.code);
    throw error;
  }
};

export const updateExpense = async (
  expenseId: string,
  updates: Partial<Omit<Expense, 'id' | 'userId' | 'createdAt'>>
): Promise<void> => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId).withConverter(expenseConverter);
    await updateDoc(expenseRef, updates);
  } catch (error: any) {
    console.error('Error updating expense:', error.message, error.code);
    throw error;
  }
};

export const deleteExpense = async (expenseId: string): Promise<void> => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    await deleteDoc(expenseRef);
  } catch (error: any) {
    console.error('Error deleting expense:', error.message, error.code);
    throw error;
  }
};

export const getExpensesSummaryByCategory = async (
  userId: string,
  month: number, // 0-11
  year: number
): Promise<{ category: string; total: number; absoluteTotal: number }[]> => {
  try {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const expensesRef = collection(db, 'expenses').withConverter(expenseConverter);
    const q = query(
      expensesRef,
      where('userId', '==', userId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    );

    const querySnapshot = await getDocs(q);
    const expenses = querySnapshot.docs.map((doc) => doc.data());

    // Group by category and sum amounts, accounting for transactionType
    const summary: { [category: string]: { total: number; absoluteTotal: number } } = {};

    expenses.forEach((expense) => {
      const { category, amount, transactionType } = expense;
      const effectiveAmount = transactionType === 'credit' ? amount : -amount; // Credits are positive, debits are negative
      const absoluteAmount = Math.abs(amount);

      if (!summary[category]) {
        summary[category] = { total: 0, absoluteTotal: 0 };
      }
      summary[category].total += effectiveAmount;
      summary[category].absoluteTotal += absoluteAmount;
    });

    // Convert to array format
    return Object.entries(summary).map(([category, { total, absoluteTotal }]) => ({
      category,
      total,
      absoluteTotal,
    }));
  } catch (error: any) {
    console.error('Error getting expenses summary:', error.message, error.code);
    throw error;
  }
};

export const subscribeToExpenses = (userId: string, callback: (expenses: Expense[]) => void): (() => void) => {
  const expensesRef = collection(db, 'expenses').withConverter(expenseConverter);
  const q = query(expensesRef, where('userId', '==', userId), orderBy('date', 'desc'));

  return onSnapshot(
    q,
    (querySnapshot) => callback(querySnapshot.docs.map((doc) => doc.data())),
    (error) => {
      console.error('Error fetching expenses:', error);
      callback([]);
    }
  );
};

export { auth, db, app, functions };