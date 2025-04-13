import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithRedirect, GoogleAuthProvider, getRedirectResult } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../services/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ currentUser: null, loading: true });

export const useAuth = () => useContext(AuthContext);

const useGoogleSignIn = () => {
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState<Error | null>(null);

  const signInWithGoogle = async () => {
    setSignInLoading(true);
    setSignInError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      setSignInError(error);
      throw error;
    } finally {
      setSignInLoading(false);
    }
  };

  // Handle redirect result
  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log('Redirect result:', result.user);
        }
      })
      .catch((error) => {
        setSignInError(error);
        console.error('Redirect error:', error);
      });
  }, []);

  return { signInWithGoogle, signInLoading, signInError };
};

const useFileUpload = () => {
  const functions = getFunctions(app, 'asia-south1');
  
  return async (file: File) => {
    try {
      const uploadFileFunction = httpsCallable(functions, 'uploadFileToDrive');
      const result = await uploadFileFunction({
        file: {
          name: file.name,
          type: file.type,
          size: file.size
        }
      });
      return result.data as { id: string; url: string };
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  };
};

const useFileUrl = (fileId: string) => {
  const functions = getFunctions(app, 'asia-south1');
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const getFileUrl = async () => {
      try {
        const getUrlFunction = httpsCallable(functions, 'getFileUrl');
        const result = await getUrlFunction({ fileId });
        setUrl(result.data as string);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    if (fileId) {
      getFileUrl();
    }
  }, [fileId]);

  return { url, loading, error };
};

const useLibraryItems = () => {
  const functions = getFunctions(app, 'asia-south1');
  const auth = useAuth();
  const [items, setItems] = useState<{id: string; title: string; url: string | null}[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = async () => {
    if (!auth.currentUser) {
      setError(new Error('User not authenticated'));
      return;
    }

    setLoading(true);
    try {
      const getItemsFunction = httpsCallable(functions, 'getUserLibraryItemsWithDriveUrls');
      const result = await getItemsFunction({ userId: auth.currentUser.uid });
      setItems(result.data as {id: string; title: string; url: string | null}[]);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { items, loading, error, fetchItems };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = { currentUser, loading };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export { useGoogleSignIn, useFileUpload, useFileUrl, useLibraryItems };
