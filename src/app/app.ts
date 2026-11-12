
import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Transaction {
  _id?: string;
  title: string;
  category: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private apiUrl = 'http://localhost:5000/api/transactions';

  transactions: Transaction[] = [];
  loading = false;
  errorMessage = '';
  successMessage = '';
  budget = 10000;

  searchText = '';
  filterType = 'all';
  filterCategory = 'all';
  filterMonth = '';
  editingId: string | null = null;

  categories = [
    'Food', 'Shopping', 'Travel', 'Education',
    'Entertainment', 'Health', 'Bills',
    'Salary', 'Freelance', 'Other'
  ];

  form: Transaction = this.emptyForm();

  get today(): Date {
    return new Date();
  }

  ngOnInit(): void {
    const savedBudget = localStorage.getItem('fintrack-budget');

    if (savedBudget !== null) {
      this.budget = Number(savedBudget);
    }

    this.loadTransactions();
  }

  emptyForm(): Transaction {
    return {
      title: '',
      category: 'Food',
      amount: 0,
      type: 'expense',
      date: new Date().toISOString().slice(0, 10)
    };
  }

  loadTransactions(): void {
    this.loading = true;
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.http.get<Transaction[]>(this.apiUrl, {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      params: {
        _: String(Date.now())
      }
    }).subscribe({
      next: (data) => {
        this.transactions = (
          Array.isArray(data) ? data : []
        ).map(t => ({
          ...t,
          amount: Number(t.amount),
          type: String(t.type).toLowerCase() as 'income' | 'expense',
          date: String(t.date).slice(0, 10)
        }));

        this.loading = false;

        console.log('Transactions:', this.transactions);
        console.log('Total:', this.transactions.length);

        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Loading failed:', error);
        this.errorMessage = 'Unable to load transactions. Check your backend.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get totalIncome(): number {
    return this.transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }

  get totalExpenses(): number {
    return this.transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }

  get balance(): number {
    return this.totalIncome - this.totalExpenses;
  }

  get transactionCount(): number {
    return this.transactions.length;
  }

  get currentMonthExpenses(): number {
    const month = new Date().toISOString().slice(0, 7);

    return this.transactions
      .filter(t =>
        t.type === 'expense' &&
        String(t.date).slice(0, 7) === month
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }

  get budgetPercentage(): number {
    if (this.budget <= 0) return 0;

    return Math.min(
      (this.currentMonthExpenses / this.budget) * 100,
      100
    );
  }

  get budgetRemaining(): number {
    return this.budget - this.currentMonthExpenses;
  }

  get recentTransactions(): Transaction[] {
    return [...this.transactions]
      .sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      .slice(0, 5);
  }

  get filteredTransactions(): Transaction[] {
    return this.transactions.filter(t => {
      const matchesSearch = t.title
        .toLowerCase()
        .includes(this.searchText.toLowerCase());

      const matchesType =
        this.filterType === 'all' || t.type === this.filterType;

      const matchesCategory =
        this.filterCategory === 'all' ||
        t.category === this.filterCategory;

      const matchesMonth =
        !this.filterMonth ||
        String(t.date).slice(0, 7) === this.filterMonth;

      return matchesSearch &&
        matchesType &&
        matchesCategory &&
        matchesMonth;
    });
  }

  get expenseCategories(): {
    name: string;
    amount: number;
    percentage: number;
  }[] {
    const grouped: { [key: string]: number } = {};

    this.transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        grouped[t.category] =
          (grouped[t.category] || 0) + Number(t.amount);
      });

    return Object.keys(grouped).map(name => ({
      name,
      amount: grouped[name],
      percentage: this.totalExpenses > 0
        ? (grouped[name] / this.totalExpenses) * 100
        : 0
    }));
  }

  submitTransaction(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (
      !this.form.title.trim() ||
      Number(this.form.amount) <= 0 ||
      !this.form.date
    ) {
      this.errorMessage = 'Please enter valid transaction details.';
      return;
    }

    const payload = {
      ...this.form,
      title: this.form.title.trim(),
      amount: Number(this.form.amount)
    };

    if (this.editingId) {
      this.http.put(
        `${this.apiUrl}/${this.editingId}`,
        payload
      ).subscribe({
        next: () => {
          this.successMessage = 'Transaction updated successfully.';
          this.resetForm();
          this.loadTransactions();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Update error:', error);
          this.errorMessage = 'Unable to update transaction.';
          this.cdr.detectChanges();
        }
      });
    } else {
      this.http.post(this.apiUrl, payload).subscribe({
        next: () => {
          this.successMessage = 'Transaction added successfully.';
          this.resetForm();
          this.loadTransactions();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Add error:', error);
          this.errorMessage = 'Unable to add transaction.';
          this.cdr.detectChanges();
        }
      });
    }
  }

  editTransaction(transaction: Transaction): void {
    if (!transaction._id) return;

    this.editingId = transaction._id;

    this.form = {
      title: transaction.title,
      category: transaction.category,
      amount: Number(transaction.amount),
      type: transaction.type,
      date: String(transaction.date).slice(0, 10)
    };

    document.getElementById('transaction-form')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  deleteTransaction(transaction: Transaction): void {
    if (!transaction._id) return;

    if (!confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    this.http.delete(
      `${this.apiUrl}/${transaction._id}`
    ).subscribe({
      next: () => {
        this.successMessage = 'Transaction deleted successfully.';
        this.loadTransactions();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Delete error:', error);
        this.errorMessage = 'Unable to delete transaction.';
        this.cdr.detectChanges();
      }
    });
  }

  resetForm(): void {
    this.form = this.emptyForm();
    this.editingId = null;
  }

  clearFilters(): void {
    this.searchText = '';
    this.filterType = 'all';
    this.filterCategory = 'all';
    this.filterMonth = '';
  }

  saveBudget(): void {
    if (this.budget < 0) {
      this.errorMessage = 'Budget cannot be negative.';
      return;
    }

    localStorage.setItem('fintrack-budget', String(this.budget));
    this.successMessage = 'Monthly budget saved successfully.';
  }

  exportCSV(): void {
    if (this.transactions.length === 0) {
      this.errorMessage = 'No transactions available to export.';
      return;
    }

    const headers = ['Title', 'Category', 'Amount', 'Type', 'Date'];

    const rows = this.transactions.map(t => [
      t.title,
      t.category,
      t.amount,
      t.type,
      t.date
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row =>
        row.map(value =>
          `"${String(value).replace(/"/g, '""')}"`
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'fintrack-transactions.csv';
    link.click();

    URL.revokeObjectURL(url);
  }

  trackById(index: number, transaction: Transaction): string | number {
    return transaction._id || index;
  }
}
