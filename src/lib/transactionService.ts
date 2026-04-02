import { supabase } from './supabase';

export interface Milestone {
  title: string;
  description: string;
  amount: number;
  order_index: number;
}

export interface TransactionDetails {
  id: string;
  project_id: string;
  owner_id: string;
  contractor_id: string;
  total_amount: number;
  platform_fee_percentage: number;
  platform_fee_amount: number;
  net_amount: number;
  initial_deposit_amount: number;
  initial_deposit_paid: boolean;
  status: 'pending' | 'escrowed' | 'active' | 'completed' | 'cancelled' | 'disputed' | 'refunded' | 'released';
  created_at: string;
  updated_at: string;
}

export interface MilestoneDetails {
  id: string;
  transaction_id: string;
  project_id: string;
  title: string;
  description: string;
  amount: number;
  order_index: number;
  status: 'pending' | 'in_progress' | 'awaiting_approval' | 'approved' | 'paid' | 'disputed';
  proof_of_work_url?: string;
  proof_of_work_description?: string;
  submitted_at?: string;
  approved_at?: string;
  paid_at?: string;
  auto_approve_deadline?: string;
  auto_approved: boolean;
  created_at: string;
}

export class TransactionService {
  /**
   * Create a new transaction with milestones
   * Server-side validation ensures all business rules are enforced
   */
  static async createTransaction(
    projectId: string,
    contractorId: string,
    totalAmount: number,
    milestones: Milestone[]
  ): Promise<{ transactionId: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('create_transaction', {
        p_project_id: projectId,
        p_contractor_id: contractorId,
        p_total_amount: totalAmount,
        p_milestones: milestones,
      });

      if (error) throw error;

      return { transactionId: data };
    } catch (error) {
      console.error('Error creating transaction:', error);
      return {
        transactionId: '',
        error: error instanceof Error ? error.message : 'Failed to create transaction',
      };
    }
  }

  /**
   * Record initial deposit payment
   * This is called after successful Stripe payment
   */
  static async fundInitialDeposit(
    transactionId: string,
    paymentIntentId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('fund_initial_deposit', {
        p_transaction_id: transactionId,
        p_payment_intent_id: paymentIntentId,
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error funding initial deposit:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fund deposit',
      };
    }
  }

  /**
   * Contractor submits proof of work for a milestone
   */
  static async submitMilestoneProof(
    milestoneId: string,
    proofUrl: string,
    proofDescription: string,
    autoApproveDays: number = 5
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('submit_milestone_proof', {
        p_milestone_id: milestoneId,
        p_proof_url: proofUrl,
        p_proof_description: proofDescription,
        p_auto_approve_days: autoApproveDays,
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error submitting proof:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit proof',
      };
    }
  }

  /**
   * Owner approves a milestone
   */
  static async approveMilestone(
    milestoneId: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('approve_milestone', {
        p_milestone_id: milestoneId,
        p_notes: notes || null,
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error approving milestone:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve milestone',
      };
    }
  }

  /**
   * Owner requests revision on a milestone
   */
  static async requestMilestoneRevision(
    milestoneId: string,
    revisionNotes: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('request_milestone_revision', {
        p_milestone_id: milestoneId,
        p_revision_notes: revisionNotes,
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error requesting revision:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to request revision',
      };
    }
  }

  /**
   * Release funds for an approved milestone
   * Automatically called after approval or can be triggered manually
   */
  static async releaseMilestoneFunds(
    milestoneId: string
  ): Promise<{ escrowId: string; success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('release_milestone_funds', {
        p_milestone_id: milestoneId,
      });

      if (error) throw error;

      return { escrowId: data, success: true };
    } catch (error) {
      console.error('Error releasing funds:', error);
      return {
        escrowId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to release funds',
      };
    }
  }

  /**
   * Fund the next milestone in the sequence
   */
  static async fundNextMilestone(
    transactionId: string,
    paymentIntentId: string
  ): Promise<{ escrowId: string; success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('fund_next_milestone', {
        p_transaction_id: transactionId,
        p_payment_intent_id: paymentIntentId,
      });

      if (error) throw error;

      return { escrowId: data, success: true };
    } catch (error) {
      console.error('Error funding next milestone:', error);
      return {
        escrowId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fund milestone',
      };
    }
  }

  /**
   * Generate a one-click approval token for a milestone
   */
  static async generateApprovalToken(
    milestoneId: string,
    expiresInDays: number = 7
  ): Promise<{ token: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('generate_approval_token', {
        p_milestone_id: milestoneId,
        p_expires_in_days: expiresInDays,
      });

      if (error) throw error;

      return { token: data };
    } catch (error) {
      console.error('Error generating token:', error);
      return {
        token: '',
        error: error instanceof Error ? error.message : 'Failed to generate token',
      };
    }
  }

  /**
   * Approve milestone using one-click token
   */
  static async approveMilestoneByToken(
    token: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('approve_milestone_by_token', {
        p_token: token,
      });

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error approving by token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve',
      };
    }
  }

  /**
   * Get transaction details with all milestones
   */
  static async getTransactionDetails(
    transactionId: string
  ): Promise<{ transaction: TransactionDetails | null; milestones: MilestoneDetails[]; error?: string }> {
    try {
      // Get transaction
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .maybeSingle();

      if (txError) throw txError;

      // Get milestones
      const { data: milestones, error: msError } = await supabase
        .from('milestones')
        .select('*')
        .eq('transaction_id', transactionId)
        .order('order_index');

      if (msError) throw msError;

      return {
        transaction,
        milestones: milestones || [],
      };
    } catch (error) {
      console.error('Error getting transaction:', error);
      return {
        transaction: null,
        milestones: [],
        error: error instanceof Error ? error.message : 'Failed to get transaction',
      };
    }
  }

  /**
   * Get all transactions for a user
   */
  static async getUserTransactions(
    userId: string,
    role: 'owner' | 'contractor'
  ): Promise<{ transactions: TransactionDetails[]; error?: string }> {
    try {
      const field = role === 'owner' ? 'owner_id' : 'contractor_id';

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq(field, userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { transactions: data || [] };
    } catch (error) {
      console.error('Error getting transactions:', error);
      return {
        transactions: [],
        error: error instanceof Error ? error.message : 'Failed to get transactions',
      };
    }
  }

  /**
   * Get audit trail for a transaction
   */
  static async getAuditTrail(
    entityType: string,
    entityId: string
  ): Promise<{ audit: any[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('audit_trail')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { audit: data || [] };
    } catch (error) {
      console.error('Error getting audit trail:', error);
      return {
        audit: [],
        error: error instanceof Error ? error.message : 'Failed to get audit trail',
      };
    }
  }
}
