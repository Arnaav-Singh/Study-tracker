import React, { useState, useEffect, useMemo } from 'react';
import { enUS } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import {
  getExpenses,
  addExpense,
  updateExpense,
  deleteExpense,
  EXPENSE_CATEGORIES,
  Expense,
} from '../services/firebase';
import { format, startOfMonth, endOfMonth, isSameMonth, addMonths, getDate } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Timestamp } from 'firebase/firestore';

// UI Components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, ResponsiveContainer, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CalendarIcon, Pencil, Trash2, Banknote, PlusCircle, FilterIcon, ReceiptText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

// New type to represent credit/debit
type TransactionType = 'credit' | 'debit';

interface ExpenseWithTransaction extends Expense {
  transactionType: TransactionType;
}

const ExpenseTracker = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<ExpenseWithTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<{ category: string; total: number; absoluteTotal: number }[]>([]);
  const [showSummaryDialog, setShowSummaryDialog] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Form states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    category: EXPENSE_CATEGORIES[0],
    description: '',
    date: new Date(),
    transactionType: 'debit' as TransactionType,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseWithTransaction | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Colors for pie chart
  const COLORS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
  ];

  // Fetch expenses
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const fetchExpenses = async () => {
      try {
        const data = await getExpenses(currentUser.uid);
        const expensesWithTransaction: ExpenseWithTransaction[] = data.map(expense => ({
          ...expense,
          transactionType: (expense as any).transactionType || 'debit',
        }));
        setExpenses(expensesWithTransaction);
      } catch (error) {
        console.error('Error fetching expenses:', error);
        toast({
          title: 'Error',
          description: 'Failed to load expense data.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchExpenses();
  }, [currentUser, toast]);

  // Auto-delete expenses on the 3rd of the new month
  useEffect(() => {
    const checkAndDeleteExpenses = async () => {
      const today = new Date();
      const day = getDate(today);
      const isThirdOfMonth = day === 3;
      const lastMonth = addMonths(today, -1);
      const isNewMonth = !isSameMonth(today, lastMonth);

      if (isThirdOfMonth && isNewMonth && expenses.length > 0) {
        if (window.confirm('It is the 3rd of the new month. Do you want to delete all expenses from the previous month?')) {
          setLoading(true);
          try {
            for (const expense of expenses) {
              await deleteExpense(expense.id);
            }
            setExpenses([]);
            toast({
              title: 'Transactions Cleared',
              description: 'All transactions from the previous month have been deleted.',
            });
          } catch (error) {
            console.error('Error deleting expenses:', error);
            toast({
              title: 'Error',
              description: 'Failed to delete transactions. Please try again.',
              variant: 'destructive',
            });
          } finally {
            setLoading(false);
          }
        }
      }
    };

    checkAndDeleteExpenses();
  }, [expenses, toast]);

  // Load summary data for selected month
  useEffect(() => {
    if (!currentUser || !showSummaryDialog) return;

    const fetchSummary = async () => {
      try {
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);

        const allExpenses = await getExpenses(currentUser.uid);
        const monthlyExpenses = allExpenses.filter(expense => {
          const expenseDate = expense.date.toDate();
          return expenseDate >= start && expenseDate <= end;
        });

        const monthlyExpensesWithTransaction = monthlyExpenses.map(expense => ({
          ...expense,
          transactionType: (expense as any).transactionType || 'debit'
        }));

        const summary: { category: string; total: number; absoluteTotal: number }[] = [];
        monthlyExpensesWithTransaction.forEach(expense => {
          const existingCategory = summary.find(item => item.category === expense.category);
          const amount = expense.transactionType === 'credit' ? expense.amount : -expense.amount;
          const absAmount = Math.abs(amount);

          if (existingCategory) {
            existingCategory.total += amount;
            existingCategory.absoluteTotal += absAmount;
          } else {
            summary.push({ category: expense.category, total: amount, absoluteTotal: absAmount });
          }
        });

        setSummaryData(summary);
      } catch (error) {
        console.error('Error fetching summary:', error);
        toast({
          title: 'Error',
          description: 'Failed to load expense summary.',
          variant: 'destructive',
        });
      }
    };

    fetchSummary();
  }, [currentUser, selectedMonth, showSummaryDialog, toast]);

  // Filter expenses by category
  const filteredExpenses = useMemo(() => {
    if (!filterCategory) return expenses;
    return expenses.filter(expense => expense.category === filterCategory);
  }, [expenses, filterCategory]);

  // Calculate pagination data
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentExpenses = filteredExpenses.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

  // Handle page change
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
  };

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle category selection
  const handleCategoryChange = (value: string | null) => {
    setFormData(prev => ({ ...prev, category: value || EXPENSE_CATEGORIES[0] }));
  };

  // Handle date selection
  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, date }));
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      amount: '',
      category: EXPENSE_CATEGORIES[0],
      description: '',
      date: new Date(),
      transactionType: 'debit',
    });
    setEditingExpense(null);
  };

  // Calculate total expenses
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => {
      return sum + expense.amount * (expense.transactionType === 'credit' ? 1 : 1);
    }, 0);
  }, [filteredExpenses]);

  // Calculate total credit and debit
  const { totalCredit, totalDebit } = useMemo(() => {
    let credit = 0;
    let debit = 0;
    filteredExpenses.forEach(expense => {
      if (expense.transactionType === 'credit') {
        credit += expense.amount;
      } else {
        debit += expense.amount;
      }
    });
    return { totalCredit: credit, totalDebit: debit };
  }, [filteredExpenses]);

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      toast({
        title: 'Error',
        description: 'You must be logged in to add expenses.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.amount || isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid positive amount.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const amount = Number(formData.amount);

      if (editingExpense) {
        await updateExpense(editingExpense.id, {
          amount,
          category: formData.category,
          description: formData.description,
          date: Timestamp.fromDate(formData.date),
          transactionType: formData.transactionType,
        });

        setExpenses(prev =>
          prev.map(exp =>
            exp.id === editingExpense.id
              ? {
                ...exp,
                amount,
                category: formData.category,
                description: formData.description,
                date: Timestamp.fromDate(formData.date),
                transactionType: formData.transactionType,
              }
              : exp
          ),
        );

        toast({
          title: 'Transaction Updated',
          description: 'Your transaction has been updated successfully.',
        });
      } else {
        const newExpenseId = await addExpense(
          currentUser.uid,
          amount,
          formData.category,
          formData.description,
          formData.date,
          formData.transactionType
        );

        const newExpense: ExpenseWithTransaction = {
          id: newExpenseId,
          userId: currentUser.uid,
          amount,
          category: formData.category,
          description: formData.description,
          date: Timestamp.fromDate(formData.date),
          createdAt: Timestamp.now(),
          transactionType: formData.transactionType,
        };

        setExpenses(prev => [newExpense, ...prev]);

        toast({
          title: 'Transaction Added',
          description: 'Your transaction has been recorded successfully.',
        });
      }

      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to save your transaction. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit expense
  const handleEditExpense = (expense: ExpenseWithTransaction) => {
    setEditingExpense(expense);
    setFormData({
      amount: expense.amount.toString(),
      category: expense.category,
      description: expense.description,
      date: expense.date.toDate(),
      transactionType: expense.transactionType,
    });
    setShowAddDialog(true);
  };

  // Handle delete expense
  const handleDeleteExpense = async (expenseId: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    try {
      await deleteExpense(expenseId);
      setExpenses(prev => prev.filter(exp => exp.id !== expenseId));
      toast({
        title: 'Transaction Deleted',
        description: 'Your transaction has been deleted successfully.',
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete your transaction. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  // Calculate total expenditure for the month (only debits)
  const totalExpenditure = useMemo(() => {
    return summaryData.reduce((sum, item) => {
      return sum + (item.total < 0 ? Math.abs(item.total) : 0);
    }, 0);
  }, [summaryData]);

  if (!currentUser) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please log in to access the Expense Tracker.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Student Expense Tracker</h1>
        <div className="flex gap-2">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingExpense ? 'Edit Transaction' : 'Add New Transaction'}</DialogTitle>
                <DialogDescription>
                  Record your student transactions (credits/debits) to keep track of your finances.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={handleInputChange}
                      className="pl-10"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transactionType">Transaction Type</Label>
                  <Select
                    value={formData.transactionType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, transactionType: value as TransactionType }))}
                  >
                    <SelectTrigger id="transactionType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit (Expense)</SelectItem>
                      <SelectItem value="credit">Credit (Income)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={handleCategoryChange}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.date ? format(formData.date, "PPP", { locale: enUS }) : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={formData.date}
                        onSelect={handleDateChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="What was this transaction for?"
                    className="min-h-[80px]"
                  />
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setShowAddDialog(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>Save</>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ReceiptText className="mr-2 h-4 w-4" />
                Monthly Summary
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Monthly Transaction Summary</DialogTitle>
                <DialogDescription>
                  Overview of your transactions for {format(selectedMonth, 'MMMM', { locale: enUS })}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col space-y-4">
                <div className="flex justify-center mb-4">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedMonth, 'MMMM', { locale: enUS })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedMonth}
                        onSelect={(date) => date && setSelectedMonth(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {summaryData.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Transactions by Category</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={summaryData.map(item => ({ ...item, total: item.absoluteTotal }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="absoluteTotal"
                              nameKey="category"
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                            >
                              {summaryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(value) => formatCurrency(Number(value))} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Category Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Category</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {summaryData.map((item) => (
                              <TableRow key={item.category}>
                                <TableCell>{item.category}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.total < 0 ? Math.abs(item.total) : 0)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow>
                              <TableCell className="font-bold">Total Expenditure</TableCell>
                              <TableCell className="text-right font-bold">
                                {formatCurrency(totalExpenditure)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-10 text-muted-foreground">
                    No transactions recorded for {format(selectedMonth, 'MMMM', { locale: enUS })}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Credit: <span className="text-green-500">{formatCurrency(totalCredit)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Debit: <span className="text-red-500">{formatCurrency(totalDebit)}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {filteredExpenses.length} transactions recorded
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Your Transactions</CardTitle>
            <Select value={filterCategory || ''} onValueChange={(val) => setFilterCategory(val || null)}>
              <SelectTrigger className="w-[180px]">
                <FilterIcon className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Categories</SelectItem>
                {EXPENSE_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found. Start by adding your first transaction!
            </div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{format(expense.date.toDate(), 'MMM d, yyyy', { locale: enUS })}</TableCell>
                        <TableCell>{expense.description || 'No description'}</TableCell>
                        <TableCell>{expense.category}</TableCell>
                        <TableCell>{expense.transactionType === 'credit' ? 'Credit' : 'Debit'}</TableCell>
                        <TableCell className={cn(
                          "text-right font-medium",
                          expense.transactionType === 'credit' ? 'text-green-500' : 'text-red-500'
                        )}>
                          {formatCurrency(expense.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditExpense(expense)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteExpense(expense.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredExpenses.length)} of {filteredExpenses.length} transactions
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpenseTracker;