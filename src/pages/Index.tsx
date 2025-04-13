import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext'; // Adjust the path if needed

const Index = () => {
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      // Check for currentUser and then navigate
      if (currentUser) {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    }
  }, [currentUser, loading, navigate]);

  // Display loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950 dark:to-indigo-950">
        <div className="animate-pulse-soft text-2xl font-semibold text-violet-600">
          Loading...
        </div>
      </div>
    );
  }

  //This return should never be reached, added to remove typescript error.
  return null;
};

export default Index;
