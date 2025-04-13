import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  addTodo,
  updateTodo,
  deleteTodo,
  subscribeToTodos,
} from '@/services/firebase';
import { Check, Plus, Trash2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'; // Corrected import path
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Todo {
  id: string;
  uid: string;
  task: string;
  completed: boolean;
  dueDate?: Date | null;
}

const TodoList = () => {
  const { currentUser } = useAuth();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newDueDate, setNewDueDate] = useState<Date | undefined>();
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = subscribeToTodos(currentUser.uid, (updatedTodos) => {
      setTodos(updatedTodos);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim() || !currentUser) return;

    try {
      await addTodo(currentUser.uid, newTask, newDueDate);
      setNewTask('');
      setNewDueDate(undefined); // Reset the due date
      toast({
        title: 'Task added',
        description: 'Your task has been added successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error adding task',
        description: 'There was a problem adding your task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleComplete = async (todo: Todo) => {
    try {
      await updateTodo(todo.id, { completed: !todo.completed });
    } catch (error) {
      toast({
        title: 'Error updating task',
        description: 'There was a problem updating your task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTodo = async (todoId: string) => {
    try {
      await deleteTodo(todoId);
      toast({
        title: 'Task deleted',
        description: 'Your task has been deleted successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error deleting task',
        description: 'There was a problem deleting your task. Please try again.',
        variant: 'destructive',
      });
    }
  };

    const handleSetDueDate = (date: Date | undefined) => {
        setNewDueDate(date);
    }

  // Filter todos by completion status
  const completedTodos = todos.filter((todo) => todo.completed);
  const pendingTodos = todos.filter((todo) => !todo.completed);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">To-Do List</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Add New Task</CardTitle>
          <CardDescription>Keep track of things you need to do</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTodo} className="space-y-4">
            <div className="flex space-x-2 items-start"> {/* Changed to items-start */}
              <Input
                placeholder="What do you need to do?"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                className="flex-1"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Calendar className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarUI
                    mode="single"
                    selected={newDueDate}
                    onSelect={handleSetDueDate}
                    className="rounded-md border"
                  />
                </PopoverContent>
              </Popover>
              <Button type="submit" size="sm" className="self-end">
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
            {newDueDate && (
              <div className="text-xs text-muted-foreground">
                Due: {format(newDueDate, 'MMM dd,yyyy')}
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pending">
            Pending ({pendingTodos.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedTodos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-8 animate-pulse-soft">
                  Loading tasks...
                </div>
              ) : pendingTodos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending tasks. Add one to get started!
                </div>
              ) : (
                <ul className="space-y-3">
                  {pendingTodos.map((todo) => (
                    <li
                      key={todo.id}
                      className="flex items-center justify-between p-3 rounded-md border task-item"
                    >
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => handleToggleComplete(todo)}
                        >
                          <div className="h-5 w-5 rounded-full border-2 flex items-center justify-center">
                            {todo.completed && <Check className="h-3 w-3" />}
                          </div>
                        </Button>
                        <span>{todo.task}</span>
                        {todo.dueDate && (
                          <span className="text-xs text-muted-foreground ml-2">
                            <Calendar className="h-3 w-3 inline-block mr-1" />
                            {format(todo.dueDate, 'MMM dd,yyyy')}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="text-center py-8 animate-pulse-soft">
                  Loading tasks...
                </div>
              ) : completedTodos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No completed tasks yet.
                </div>
              ) : (
                <ul className="space-y-3">
                  {completedTodos.map((todo) => (
                    <li
                      key={todo.id}
                      className="flex items-center justify-between p-3 rounded-md border task-item bg-muted/30"
                    >
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onClick={() => handleToggleComplete(todo)}
                        >
                          <div className="h-5 w-5 rounded-full border-2 bg-primary border-primary flex items-center justify-center">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        </Button>
                        <span className="ml-2 line-through text-muted-foreground">
                          {todo.task}
                        </span>
                        {todo.dueDate && (
                          <span className="text-xs text-muted-foreground ml-2 line-through">
                            <Calendar className="h-3 w-3 inline-block mr-1" />
                            {format(todo.dueDate, 'MMM dd,yyyy')}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TodoList;

