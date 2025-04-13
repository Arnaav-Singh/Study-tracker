import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { getTimetable, addTimeSlot, deleteTimeSlot, TimeSlot } from '../services/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, PlusCircle, Calendar, Clock, Book } from 'lucide-react';
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from 'framer-motion';

const daysOfWeek = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday',
  'Friday', 'Saturday', 'Sunday'
];

const Timetable: React.FC = () => {
  const [timetable, setTimetable] = useState<TimeSlot[]>([]);
  const [newSlot, setNewSlot] = useState<Omit<TimeSlot, 'id' | 'userId' | 'createdAt'>>({
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    subject: ''
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      if (user) {
        fetchTimetable(user.uid);
      } else {
        setTimetable([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchTimetable = async (userId: string) => {
    try {
      const slots = await getTimetable(userId);
      setTimetable(slots);
    } catch (error) {
      console.error('Error fetching timetable:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewSlot(prev => ({ ...prev, [name]: value }));
  };

  const addTimeSlotHandler = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!auth.currentUser || !isAuthenticated) {
      console.error('User not authenticated');
      return;
    }

    try {
      await addTimeSlot(auth.currentUser.uid, {
        day: newSlot.day,
        startTime: newSlot.startTime,
        endTime: newSlot.endTime,
        subject: newSlot.subject
      });

      await fetchTimetable(auth.currentUser.uid);

      setNewSlot({
        day: 'Monday',
        startTime: '09:00',
        endTime: '10:00',
        subject: ''
      });
    } catch (error) {
      console.error('Error adding time slot:', error);
    }
  };

  const deleteTimeSlotHandler = async (slotId: string) => {
    if (!auth.currentUser || !isAuthenticated) {
      console.error('User not authenticated');
      return;
    }

    try {
      await deleteTimeSlot(slotId);
      await fetchTimetable(auth.currentUser.uid);
    } catch (error) {
      console.error('Error deleting time slot:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading timetable...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Please sign in to view your timetable.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
        Create Your Timetable
      </h2>

      <form
        onSubmit={addTimeSlotHandler}
        className="flex flex-col sm:flex-row gap-4 mb-8 bg-white/10 backdrop-blur-md p-4 rounded-lg shadow-md border border-white/10 items-end"
      >
        <Select
          name="day"
          value={newSlot.day}
          onValueChange={(value) => handleInputChange({ target: { name: 'day', value } } as React.ChangeEvent<HTMLSelectElement>)}
        >
          <SelectTrigger className="w-full sm:w-[180px] bg-white/20 text-gray-800 border-purple-500/30 relative">
            <SelectValue placeholder="Day" className="text-gray-800"/>
            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-purple-500/30">
            {daysOfWeek.map(day => (
              <SelectItem key={day} value={day} className="hover:bg-purple-500/20 text-white">
                {day}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="time"
          name="startTime"
          value={newSlot.startTime}
          onChange={handleInputChange}
          required
          className="w-full sm:w-[150px] bg-white/20 text-gray-800 border-blue-500/30"
        />

        <Input
          type="time"
          name="endTime"
          value={newSlot.endTime}
          onChange={handleInputChange}
          required
          className="w-full sm:w-[150px] bg-white/20 text-gray-800 border-blue-500/30"
        />

        <Input
          type="text"
          name="subject"
          value={newSlot.subject}
          onChange={handleInputChange}
          placeholder="Subject/Activity"
          required
          className="w-full bg-white/20 text-gray-800 border-green-500/30"
        />

        <Button
          type="submit"
          className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 shadow-lg self-start"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Slot
        </Button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {daysOfWeek.map(day => (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white/10 backdrop-blur-md p-4 rounded-lg shadow-md border border-white/10"
            >
              <h3 className="text-lg font-semibold text-gray-200 mb-4">{day}</h3>
              {timetable
                .filter(slot => slot.day === day)
                .sort((a, b) => a.startTime.localeCompare(b.startTime))
                .map(slot => (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-between p-2 my-2 bg-gray-800/50 rounded-md border border-gray-700"
                  >
                    <span className="text-gray-300 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {`${slot.startTime} - ${slot.endTime}`}
                    </span>
                    <span className="text-white flex items-center gap-2">
                      <Book className="h-4 w-4" />
                      {slot.subject}
                    </span>
                    <Button
                      onClick={() => slot.id && deleteTimeSlotHandler(slot.id)}
                      className="bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 p-1 rounded-full transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </motion.div>
                ))}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Timetable;

