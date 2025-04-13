import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app, auth } from '../services/firebase';
import useDrivePicker from 'react-google-drive-picker';
import { Button } from '@/components/ui/button';
import { Loader2, File, AlertCircle, CheckCircle, Trash2, UploadCloud, Link, FilePlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion'; // Import framer-motion

interface LibraryItem {
  id: string;
  title: string;
  url: string | null;
  createdAt?: string; // Optional, if you have this data
}

const Library = () => {
  const { currentUser } = useAuth();
  const functions = getFunctions(app, 'asia-south1');

  if (process.env.NODE_ENV === 'development') {
    connectFunctionsEmulator(functions, 'localhost', 5001);
  }

  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<Error | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [openPicker, authResponse] = useDrivePicker();
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const fetchLibraryItems = useCallback(async () => {
    if (!currentUser) {
      console.log('No current user, skipping fetch');
      setLibraryItems([]);
      return;
    }

    setLibraryLoading(true);
    try {
      const getLibraryItemsFunction = httpsCallable(functions, 'getUserLibraryItemsWithDriveUrls');
      const result = await getLibraryItemsFunction({ userId: currentUser.uid });
      const items = Array.isArray(result.data) ? result.data : [];
      // Sort items by creation date, if available
      const sortedItems = items.sort((a: LibraryItem, b: LibraryItem) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0; // Keep original order if createdAt is missing
      });
      setLibraryItems(sortedItems);
      setLibraryError(null);
    } catch (err: any) {
      console.error('Failed to load library items:', err);
      setLibraryItems([]);
      setLibraryError(err);
    } finally {
      setLibraryLoading(false);
    }
  }, [currentUser, functions]);

  // Fetch library items when the user logs in or the component mounts
    useEffect(() => {
        if (currentUser) {
            fetchLibraryItems();
        }
    }, [currentUser, fetchLibraryItems]);

  const handleOpenPicker = () => {
    if (!currentUser) {
      setLibraryError(new Error('Please sign in to use the Drive Picker.'));
      return;
    }

    openPicker({
      clientId: '517475969826-l48djhg45vmere8cc3gb28d0r8dsckmj.apps.googleusercontent.com',
      developerKey: 'AIzaSyB7r2whc9VU6fY0Qg_Pgt_wmoR_OHnQkDk', // Replace with your API key
      viewId: 'DOCS',
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      callbackFunction: async (data) => {
        if (data.action === 'cancel') {
          console.log('User clicked cancel/close button');
        } else if (data.docs) {
          console.log('Selected files:', data.docs);
          setSelectedFiles(data.docs);
          setUploading(true);
          setUploadSuccess(false); // Reset on new upload attempt
          try {
            const uploadFilesFunction = httpsCallable(functions, 'addFilesToLibrary'); // Corrected function name
            const result = await uploadFilesFunction({
                userId: currentUser.uid,
                files: data.docs.map((doc: any) => ({
                    name: doc.name,
                    url: doc.url,
                    mimeType: doc.mimeType,
                })),
            });
            console.log("Upload result:", result);
            setUploadSuccess(true);
            setSelectedFiles([]); // Clear selection after successful upload
            fetchLibraryItems(); // Refresh the list
          } catch (error: any) {
            console.error("Error uploading files:", error);
            setLibraryError(new Error(`Failed to upload files: ${error.message}`));
          } finally {
            setUploading(false);
          }
        }
      },
    });
  };

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      console.error('Sign-in error:', error);
      setLibraryError(new Error(`Failed to sign in: ${error.message}`));
    }
  };

  const handleRemoveFile = (index: number) => {
      setSelectedFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  const handleDeleteLibraryItem = async (itemId: string) => {
    try {
      const deleteFunction = httpsCallable(functions, 'deleteLibraryItem');
      await deleteFunction({ itemId });
      setLibraryItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      setLibraryError(new Error(`Failed to delete item: ${err.message}`));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">My Study Library</h1>

      {libraryError && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-md flex items-start gap-2">
          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <p>{libraryError.message}</p>
        </div>
      )}

      {!currentUser && (
        <div className="mb-6">
          <Button
            onClick={handleSignIn}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-md transition-colors duration-300 flex items-center gap-2"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 36 36"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="#4285F4"
                d="M35.613 18.116c0-1.03-.094-2.036-.266-3.016H18v5.68h9.444c-.606 3.7-5.26 11.833-11.294 11.833-6.884 0-12.488-5.604-12.488-12.488 0-6.884 5.604-12.488 12.488-12.488 3.056 0 5.762 1.048 7.89 2.76l5.98-5.98c-3.857-3.59-8.826-5.74-14.03-5.74-11.323 0-20.516 9.193-20.516 20.516 0 11.323 9.193 20.516 20.516 20.516 11.05 0 20.84-7.627 20.84-19.45v-1.294z"
              />
              <path
                fill="#34A853"
                d="M18 36c4.966 0 9.186-1.666 12.373-4.48l-5.98-5.98c-3.308 2.254-7.57 3.54-16.393 3.54-12.723 0-23.09-10.277-23.09-23s10.367-23 23.09-23c4.78 0 9.223 1.73 12.694 4.544l5.98-5.98c-3.857-3.59-8.826-5.74-14.03-5.74-11.323 0-20.516 9.193-20.516 20.516 0 11.323 9.193 20.516 20.516 20.516z"
              />
              <path fill="#FBBC05" d="M35.613 18.116c0-.668-.057-1.304-.156-1.916H18v3.643h9.97c-.105.673-.416 2.254-.416 2.254s3.12 2.27 3.64 2.833c.449-.873.708-1.817.708-2.814z" />
              <path fill="#EA4335" d="M9.31 10.707c-.796 2.486-1.244 5.25-1.244 8.08 0 2.83.448 5.594 1.244 8.08l-5.957 5.957C1.334 28.96 0 23.79 0 18.08 0 12.37 1.333 7.2 3.353 3.25l5.957 5.957z" />
            </svg>
            Sign in with Google
          </Button>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Sign in to access your Google Drive.</p>
        </div>
      )}

      {currentUser && (
        <div className="mb-6">
          <div className="mb-4 flex flex-wrap gap-4 items-center">
            <Button
              onClick={handleOpenPicker}
              className={cn(
                "bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-md transition-colors duration-300 flex items-center gap-2",
                libraryLoading && "opacity-70 cursor-not-allowed"
              )}
              disabled={libraryLoading}
            >
              {libraryLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Upload from Google Drive
                </>
              )}
            </Button>
            {uploading && (
                <span className="text-blue-500 font-medium flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </span>
            )}
            {uploadSuccess && (
                <span className="text-green-500 font-medium flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Upload successful!
                </span>
            )}
          </div>

          <AnimatePresence>
            {selectedFiles.map((file, index) => (
              <motion.div
                key={`selected-file-${index}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="border rounded-md p-4 mb-4 bg-white dark:bg-gray-800 shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-lg text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                      <File className="h-4 w-4" />
                      {file.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Link className="h-4 w-4" />
                      Type: {file.mimeType}
                    </p>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm mt-2 inline-flex items-center gap-1"
                    >
                      <Link className="h-4 w-4" />
                      Open File
                    </a>
                  </div>
                  <Button
                    onClick={() => handleRemoveFile(index)}
                    className="bg-red-600/20 hover:bg-red-700/20 text-red-600 hover:text-red-700 text-sm font-medium px-3 py-1.5 rounded-md transition-colors duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {libraryItems.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow duration-300 border border-gray-200 dark:border-gray-700">
                    <CardHeader>
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                        <FilePlus className="h-5 w-5" />
                        {doc.title}
                      </CardTitle>
                      <CardDescription className="text-gray-500 dark:text-gray-400">
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline text-sm inline-flex items-center gap-1"
                          >
                            <Link className="h-4 w-4" />
                            View in Google Drive
                          </a>
                        ) : (
                          <span className="text-gray-600 text-sm">Link not available</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => handleDeleteLibraryItem(doc.id)}
                        className="bg-red-600/20 hover:bg-red-700/20 text-red-600 hover:text-red-700 text-sm font-medium px-4 py-2 rounded-md transition-colors duration-200 w-full flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {libraryItems.length === 0 && !libraryLoading && (
            <div className="text-center py-6 bg-gray-50 dark:bg-gray-900/50 rounded-md border border-dashed border-gray-300 dark:border-gray-700">
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Your library is empty. Upload files from Google Drive to get started.
                </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Library;

