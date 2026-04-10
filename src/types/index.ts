
export type TransactionType = 'sale' | 'purchase' | 'income' | 'spent' | 'receive' | 'give' | 'credit_sale' | 'transfer' | 'credit_purchase' | 'sale_return' | 'purchase_return' | 'credit_give' | 'credit_income';
export type PaymentMethod = 'cash' | 'bank'; // This might become deprecated in favor of accountId
export type TransactionVia = 'Personal' | 'Rushaib Traders' | 'R&B Corporation';

export interface ChargeRule {
  name: string;
  type: 'expense' | 'income';
  calculation: 'fixed' | 'percentage';
  value: number;
  transactionType?: TransactionType;
}

export interface Payment {
    accountId: string;
    amount: number;
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface ExpenseBook {
  id: string;
  name: string;
  type: 'income' | 'spent' | 'receive' | 'give';
  categories: ExpenseCategory[];
  via?: string;
}

export interface Transaction {
  id: string;
  date: string;
  effectiveDate?: string; // For delivery/receipt date
  description: string;
  amount: number;
  type: TransactionType;
  accountId?: string; // Optional because credit_sale, spent, income might not have it
  partyId?: string;
  enabled: boolean;
  category?: string;
  via?: string;
  status?: 'pending' | 'delivered' | 'cancelled';
  paymentStatus?: 'pending' | 'approved' | 'rejected';
  // For transfers
  fromAccountId?: string;
  toAccountId?: string;
  involvedAccounts?: string[]; // New field to track all accounts in a transaction
  items?: { 
    id: string; 
    name: string; 
    quantity: number; 
    price: number; 
    cost?: number; 
    location?: string;
    batchNumber?: string;
    expiryDate?: string;
    receiveDate?: string;
    date?: string; // For manual invoice items
  }[];
  payments?: Payment[]; // For POS multiple payments
  invoiceNumber?: string;
  discount?: number;
  previousBalance?: number; // For receipts
  deliveredBy?: string; // ID of the party who delivered
  deliveryCharge?: number;
  deliveryChargePaidBy?: 'customer' | 'institution';
  deliveryChargePaid?: boolean; // New field to track if delivery charge is paid
  serviceId?: string | null; // To link with a customer service
  txRef?: string; // Unique reference for a transaction attempt
  verifiedByStaffId?: string;
  verificationNote?: string;
  autoTransactionRuleId?: string; // ID of the rule that created this transaction
  createdAt?: string; // ISO string
  suspicionReviewed?: boolean;
  suspicionReviewNote?: string;
  adminNotified?: boolean;
}

export interface AmortizationEntry {
  installment: number;
  dueDate: string;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
  status: 'paid' | 'unpaid' | 'due';
  paidOn?: string;
  paymentDetails?: {
    mode: string; // Account ID
    amount: number;
    principal: number;
    interest: number;
    description?: string;
  }
}

export interface Loan {
  id: string;
  loanNumber: string;
  principal: number;
  interestRate?: number;
  interestType: 'no_interest' | 'simple' | 'compound';
  repaymentType: 'principal_interest' | 'interest_only_indefinite' | 'principal_interest_custom' | 'interest_only';
  tenure?: number;
  tenureUnit?: 'days' | 'weeks' | 'months';
  paymentFrequency: 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly';
  startDate: string;
  firstEmiDate: string;
  processingFee?: number;
  schedule: AmortizationEntry[];
  isActive: boolean;
  disbursementType: 'receive_in_account' | 'credit_only';
  disbursementAccountId?: string;
  // For EMI based calculation
  calculationMode?: 'rate' | 'emi';
  totalInstallments?: number;
  installmentAmount?: number;
}

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO string
  action: 'login' | 'logout' | 'view_page' | 'update_profile' | 'call_made';
  details?: {
    page?: string;
    [key: string]: any;
  };
}

export interface SpecificPrice {
    productId: string;
    productName?: string; // Optional: denormalized for easier display
    price: number;
}

export interface Party {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  group?: string;
  partyType?: string; // e.g., Customer, Supplier, Friend, Family, Delivery, Staff, Loan, Marketing
  lastContacted?: string; // ISO string
  lastSeen?: string; // ISO string for portal activity
  status?: string;
  imageUrl?: string;
  balance?: number; // This can be a transient property on the client
  password?: string;
  sendSmsDefault?: boolean; // New field for SMS preference
  pendingNameChange?: string; // For admin approval
  permissions?: {
    viewLedger?: boolean;
    [key: string]: boolean | undefined;
  };
  loans?: Loan[];
  loanDetails?: { // Optional details if partyType is 'Loan'
    principal: number;
    interestRate: number;
    term: number; // in months
    issueDate: string;
  }
  activity?: ActivityLog[];
  servicePackage?: string;
  serviceUsage?: { [serviceId: string]: number };
  specificPrices?: SpecificPrice[];
  totalTasks?: number;
  pendingTasks?: number;
  viewablePartyTypes?: string[];
  viewablePartyGroups?: string[];
  hasUnreadAdminMessages?: boolean;
  hasUnreadUserMessages?: boolean;
  marketingProductIds?: string[];
}

export interface SubscriptionHistory {
  id: string;
  subscriptionDate: string; // ISO string
  expiryDate: string; // ISO string
  amount: number;
  transactionId?: string;
  notes?: string;
}
export interface ClubMember {
  id: string;
  name: string;
  phone: string;
  address: string;
  memberId: string;
  joinDate: string; // ISO string
  status: 'active' | 'inactive' | 'banned';
  imageUrl?: string;
  email?: string;
  facebookName?: string;
  facebookUrl?: string;
  referenceId?: string;
  referenceName?: string;
  referenceUrl?: string;
  subscriptionEndDate?: string;
  transactionNumber?: string;
  memberCategory?: string;
  subscriptionHistory?: SubscriptionHistory[];
  banUntil?: string | null;
  bannedAt?: string | null;
  banReason?: string;
  adminNotes?: string;
  profitBalance?: number;
}

export interface Task {
  id:string;
  title: string;
  description?: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  dueDate: string; // ISO string
  progress: number;
  status: 'in-progress' | 'completed' | 'cancelled';
  createdAt: string; // ISO string
  history: {
    date: string; // ISO string
    action: string;
    comment?: string;
    progress?: number;
  }[];
  reminder?: string; // ISO string
  reminderSent?: boolean;
  reminderOffset?: number; // The value (e.g., 30)
  reminderUnit?: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'; // The unit
  overdueNotified?: boolean;
  assignedToId?: string;
  assignedToName?: string;
  partyId?: string;
  partyName?: string;
}

export interface RnbService {
  id: string;
  name: string;
}

export interface RnbContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  customerSince: string; // ISO date string
  permissions: Record<string, boolean>; // Key is serviceId, value is permission status
  password?: string;
}

export interface RnbLog {
  id: string;
  contactId: string;
  contactName: string;
  action: string;
  timestamp: string; // ISO string
}

export interface RnbTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  dueDate: string; // ISO string
  assignedToId: string;
  assignedToName: string;
  address?: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  updates: {
    text: string;
    by: 'admin' | 'user';
    userName: string;
    date: string; // ISO string
  }[];
}

export interface PoProduct {
    id: string;
    name: string;
    price: number;
    cost: number;
    wholesalePrice?: number;
}

export interface PoSupplier {
    id: string;
    name: string;
    phone: string;
    address: string;
    group?: string; // Add group to supplier type
}

export interface OrderItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  currentStock: number;
  isNew?: boolean;
}

export interface PurchaseOrder {
    id: string;
    orderDate: string;
    supplier: { id: string; name: string; phone: string; address: string; group?: string; };
    items: Omit<OrderItem, 'id'>[];
    totalAmount: number;
    totalProducts: number;
    createdAt: any;
    via: TransactionVia;
    status?: 'completed' | 'pending';
}

// --- Inventory Types ---
export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  brand?: string;
  price: number; // Sale Price
  wholesalePrice?: number;
  cost: number; // Last Purchase Price (for reference)
  quantity: number; // Total quantity across all locations
  stock?: { [location: string]: number }; // Per-location stock
  minStockLevel: number;
  supplier?: string;
  barcode?: string;
  sku: string;
  location?: string;
  imageUrl?: string;
  createdAt?: string; // ISO String
  updatedAt?: string; // ISO String
  costHistory?: { date: string; quantity: number; cost: number }[]; // For FIFO
  via?: string;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'transfer';
  quantity: number; // Can be negative for sales/adjustments
  date: string; // ISO String
  reference?: string;
  notes?: string;
  userId?: string; // Who performed the action
  location?: string; // Location of the movement
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
}

export interface HSLColor {
    h: number;
    s: number;
    l: number;
}

export interface ColorTheme {
    name: string;
    colors: {
        primary: HSLColor;
        secondary: HSLColor;
        accent: HSLColor;
    };
}

export interface DepositChannel {
    accountId: string;
    senderIdentifier: string;
    messageFilterType?: 'all' | 'startsWith' | 'endsWith' | 'contains' | 'exact';
    messageFilterText?: string;
}

export interface CustomerService {
    id: string;
    name: string;
    description?: string;
    price?: number; // Optional now
    amountType?: 'fixed' | 'any'; // New field
    depositChannels?: DepositChannel[];
    productId?: string;
    productName?: string;
    quantity?: number;
    usageLimit?: number;
    type: 'income' | 'sale' | 'receive' | 'give';
    enabled: boolean;
    isUnlimited?: boolean;
    startDate?: string;
    endDate?: string;
    verifiableBy?: string[];
    lastUpdatedAt?: string;
    via?: string;
}

export interface PaymentInstruction {
    method: string;
    number: string;
    type: string;
}

export interface BusinessProfile {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  themeName?: string;
  paymentInstruction?: PaymentInstruction;
  logoUrl?: string;
  location?: string;
}

export interface SalesTarget {
  id: string;
  type?: 'monthly' | 'programme';
  month: string; // YYYY-MM
  businessProfile: string;
  productIds: string[];
  productNames: string[];
  quantityTarget: number;
  programmeQuantityTarget?: number;
  partyId?: string;
  partyName?: string;
  programmeDateRange?: {
    from: string;
    to: string;
  };
}

// --- Stock Audit Types ---
export interface AuditItem {
  id: string;
  name: string;
  type: 'stock' | 'cash';
  systemBalance: number;
  physicalBalance: number;
  difference: number;
}

export interface StockAudit {
  id: string;
  createdAt: string; // ISO string for the date of the audit
  items: AuditItem[];
}

export interface ReceivingNumber {
  id: string;
  name: string;
  number: string;
}
export interface Account {
  id: string;
  name: string;
  balance: number;
  chargeRules?: ChargeRule[];
  receivingNumbers?: ReceivingNumber[];
}

export interface AutoTransactionRule {
  id: string;
  name: string;
  enabled: boolean;
  senderIdentifier: string;
  amountKeyword: string;
  messageFilter?: string;
  transactionType: 'income' | 'spent' | 'receive' | 'give';
  accountId: string;
  partyId?: string;
  via?: string;
}

export interface SheetRow {
  date: string;
  name: string;
  message: string;
}

export interface SmsProcessingResult {
    status: 'success' | 'skipped' | 'error';
    reason?: string;
    sms: SheetRow;
    transaction?: Omit<Transaction, 'id' | 'enabled'>;
    ruleName?: string;
    amount?: number;
}

export interface SmsSyncLog {
    date: string;
    created: number;
    skipped: number;
    errors: number;
    results: SmsProcessingResult[];
}

export interface SmsSyncSettings {
  autoReloadEnabled: boolean;
  reloadInterval: number; // in seconds
}

export interface SmsBlocklistRule {
    id: string;
    type: 'sender' | 'exact' | 'contains' | 'startsWith';
    value: string;
}

// --- SMS Log Type ---
export interface SmsLog {
  id: string;
  createdAt: string; // ISO string
  provider: 'Twilio' | 'SMSQ' | 'Pushbullet';
  to: string;
  partyName: string;
  message: string;
  status: 'success' | 'failed';
  error?: string;
  segments: number;
  isRead?: boolean;
}

export interface SmsPackage {
  id: string;
  provider: 'Twilio' | 'SMSQ' | 'Pushbullet';
  purchaseDate: string; // ISO Date
  quantity: number;
  cost: number;
  expiryDate: string; // ISO Date
}

export interface MemberCategoryConfig {
  id: string;
  name: string;
  profitPercentage: number;
  joiningFee: number;
  subscriptionDays: number;
  incrementOnNewMember?: number; // New field
}

export interface ShopTimeSettings {
    startTime: string; // "HH:MM"
    closeTime: string; // "HH:MM"
}

export interface ShopDayReport {
    id: string;
    date: string; // YYYY-MM-DD
    type: 'OPEN' | 'CLOSE';
    timestamp: string; // ISO string
    physicalBalances: {
        accountName: string;
        accountId: string;
        balance: number;
        breakdown: Record<number, string>;
    }[];
    totalAmount: number;
    // For closing reports
    systemBalances?: { accountName: string; balance: number }[];
    discrepancies?: { accountName: string; difference: number }[];
}

export interface PageSecurity {
  area: 'admin' | 'user';
  pin?: string;
  disabled?: boolean;
  disabledNotice?: string;
}

export interface NewsCategory {
  id: string;
  name: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  category: string;
  status: 'published' | 'draft';
  createdAt: string; // ISO Date String
  featured?: boolean;
  author: {
    name: string;
    avatarUrl: string;
  };
  views: number;
}

// --- App Settings Types ---
export interface CustomFoodItem {
  id: string;
  name: string;
  points: number;
}

export interface FitnessChallengeSettings {
  height?: number; // User height in cm
  weightGoal?: number; // User weight goal in kg
  duration: number;
  highPointFoods: CustomFoodItem[];
  mediumPointFoods: CustomFoodItem[];
  lowPointFoods: CustomFoodItem[];
}

export interface AppSettings {
    businessProfiles: BusinessProfile[];
    partyTypes: string[];
    partyGroups: string[];
    inventoryLocations?: string[];
    fontSize?: number;
    customerServices?: CustomerService[];
    autoTransactionRules?: AutoTransactionRule[];
    smsBlocklist?: SmsBlocklistRule[];
    doneSms?: SheetRow[];
    lastSyncResult?: SmsSyncLog | null;
    googleSheetId?: string;
    expenseBooks?: ExpenseBook[];
    smsServiceEnabled?: boolean;
    smsWebhookUrl?: string;
    smsApiKey?: string;
    inventoryCategories?: InventoryCategory[];
    securityQuestion?: string;
    securityAnswer?: string;
    adminLockedPages?: string[];
    userLockedPages?: string[];
    pageSecurity?: { [key: string]: PageSecurity };
    autoLockTimeout?: number;
    salesTargets?: SalesTarget[];
    smsSyncSettings?: SmsSyncSettings;
    projectionReceivablePartyIds?: string[];
    projectionPayablePartyIds?: string[];
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioMessagingServiceSid?: string;
    smsProvider?: 'twilio' | 'smsq' | 'pushbullet';
    smsqApiKey?: string;
    smsqClientId?: string;
    smsqSenderId?: string;
    pushbulletAccessToken?: string;
    pushbulletDeviceId?: string;
    tradeLicenceFieldOrder?: TradeLicenceField[];
    smsTemplates?: SmsTemplate[];
    smsPackages?: SmsPackage[];
    smsAlertSettings?: {
        lowBalanceThreshold: number;
        expiryWarningDays: number;
    };
    memberCategoryConfig?: MemberCategoryConfig[];
    shopTimeSettings?: ShopTimeSettings;
    shopDayReports?: ShopDayReport[];
    fitnessChallenge?: FitnessChallengeSettings;
    newsCategories?: NewsCategory[];
}

// --- Planning Types ---
export interface PlanEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: TransactionType;
  planId?: string; // Link to a PlanProject
  accountType: 'cash' | 'bank'; // Which balance to affect
  enabled: boolean;
  partyId?: string;
  partyName?: string;
  items?: {
    id: string;
    name: string;
    quantity: number;
    price: number;
  }[];
};

export interface PlanProject {
    id: string;
    name: string;
    rawStartingBalance: { cash: number; bank: number; total: number; };
    selectedAccountIds?: string[];
}


// --- Old Data Types ---
export interface OldParty {
  id: string;
  name: string;
  pdfUrl: string;
  createdAt: string; // ISO string
}

export interface OldDataLedger {
  partyId: string;
  data: Record<string, string | number>[];
  lastUpdated: string; // ISO string
}

// --- Custom Statement Types ---
export interface StatementEntry {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

export interface CustomStatement {
    id: string;
    partyId: string;
    partyName: string;
    statementDate: string; // ISO string
    businessProfileName: string;
    dateRange: { from: string, to: string };
    data: StatementEntry[];
}

// --- Truck & Gift Tracking ---
export interface TruckGiftTrackRecord {
  id: string;
  driverName?: string;
  driverPhone?: string;
  truckNumber?: string;
  deliveryAddress: string;
  productName: string;
  quantity?: number;
  customers: { id: string; name: string; }[];
  deliveryPersonId?: string;
  deliveryPersonName?: string;
  createdAt?: string; // ISO string
  deliveryDate?: string;
  giftDate?: string;
  gift?: {
    description?: string;
    recipients?: { id: string; name: string; }[];
  }
}

// --- Reminder Type ---
export interface Reminder {
  id: string;
  partyId: string;
  partyName: string;
  dueAmount: number;
  /** @deprecated Use reminderDates instead */
  reminderDate?: string; // ISO string
  reminderDates: string[]; // Array of ISO strings
  status: 'pending' | 'completed' | 'sent';
  notes?: string;
  createdAt: string; // ISO string
  nextReminder?: string; // transient property for UI
  isPinned?: boolean;
  dueDate: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  history: {
    date: string;
    action: string;
    comment: string;
  }[];
}

// --- Custom Profit Calculation ---
export type CalculationRow = {
  id: string;
  businessProfile: string;
  type: 'auto' | 'manual';
  dateFrom: string; // YYYY-MM
  dateTo: string; // YYYY-MM-DD
  commissionDateFrom?: string;
  commissionDateTo?: string;
  commission: number;
  commissionIds?: string[];
  expectedCommission: number;
  products: { productId: string; quantity: number; name: string }[];
  totalQuantity: number;
  expense: number;
  expenseIds?: string[];
  otherIncome: number;
  otherIncomeIds?: string[];
  stockProfit: number;
  stockProfitProductIds?: string[]; // IDs of products included in manual stock profit
  netProfit: number;
};

export interface ProfitCalculationProject {
  id: string;
  name: string;
  rows: CalculationRow[];
}

// --- Custom Project Management ---
export interface Project {
    id: string;
    name: string;
    transactions: Transaction[];
}

// --- Costing Calculator ---
export interface CostingItem {
    id: string;
    productId?: string;
    name?: string;
    quantity: number;
    purchasePrice: number;
    transportCost?: number;
    unloadingCost?: number;
    commission?: number;
    finalCost: number;
    sellingPrice?: number;
    profitLoss?: number;
    selectedAccountIds: string[];
}

export interface CostingProject {
    id: string;
    name: string;
    createdAt: string; // ISO String
    items: CostingItem[];
    totalCost: number;
    totalDoCost: number;
    totalProfit: number;
}


export interface VerificationResult {
    isVerified: boolean;
    accountId?: string;
    amount?: number;
    success?: boolean; // To indicate if the whole process was successful
    isPending?: boolean; // To indicate if it needs manual verification
}

export interface QuotationItem {
  id: string; // Corresponds to InventoryItem id
  name: string;
  quantity: number;
  price: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  partyId?: string;
  partyName: string;
  date: string; // ISO string date
  items: QuotationItem[];
  totalAmount: number;
  notes?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  createdAt?: string; // ISO string
  via?: string;
}

export interface NoteListItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Note {
  id: string;
  title?: string;
  content?: string;
  items?: NoteListItem[];
  imageUrl?: string;
  color?: string;
  isPinned?: boolean;
  createdAt?: string; // ISO string
  updatedAt?: string; // ISO string
  partyId?: string;
  date?: string; // Optional specific date for the note
}

// --- E-care Types ---
export interface ServiceRecord {
  id: string;
  date: string; // ISO string
  servicePerson: string;
  servicePersonPhone?: string;
  cost: number;
  description: string;
  nextServiceDate?: string; // ISO string
}

export interface EcareItem {
  id: string;
  name: string;
  category: string;
  purchaseDate: string; // ISO string
  purchasePrice: number;
  recoveredAmount?: number;
  warrantyPeriod: string; // e.g., "2 years", "6 months"
  notes?: string;
  serviceHistory: ServiceRecord[];
  nextServiceDate?: string; // ISO string
}

// --- Electricity Management ---
export interface MeterReading {
  id: string;
  date: string;
  reading: number;
  rechargeAmount: number;
  paidOn?: string;
  paymentDetails?: {
      mode: string;
      amount: number;
      principal: number;
      interest: number;
      description?: string;
  };
}

export interface ExpenseHistoryEntry {
  id: string;
  fromDate: string;
  toDate: string;
  consumedAmount: number;
  postedAt: string; // ISO string
  currentBalance?: number;
}

export interface ElectricityInfo {
  id: string;
  label: string;
  meterNumber: string;
  consumerNumber: string;
  phone?: string;
  readings?: MeterReading[];
  expenseHistory?: ExpenseHistoryEntry[];
}
      
// --- Chat/Support Types ---
export interface ChatMessage {
    id: string;
    senderId: 'admin' | string; // 'admin' or partyId
    senderName: string;
    text: string;
    timestamp: string; // ISO String
}

export interface ChatThread {
    id: string; // partyId
    partyName: string;
    messages: ChatMessage[];
    lastUpdatedAt: string; // ISO String
    hasUnreadAdminMessages: boolean; // Flag for admin
    hasUnreadUserMessages: boolean; // Flag for user
}

// --- Manual Invoice Types ---
export interface ManualInvoiceItem {
    id: string;
    name: string;
    date: Date;
    quantity: number;
    price: number;
    cost?: number;
    originalTxId?: string; // To link back to an original transaction if imported
}

export interface ManualInvoice {
    id: string;
    invoiceNumber: string;
    date: string;
    partyId?: string;
    partyName: string;
    businessProfileName: string;
    businessProfileAddress?: string;
    businessProfilePhone?: string;
    items: ManualInvoiceItem[];
    subTotal: number;
    totalAmount: number;
    discount?: number;
    deliveryCharge?: number;
    isPaid?: boolean;
    createdAt: string; // ISO string
}

// --- Warisan Certificate ---
export interface Heir {
    name: string;
    relation: string;
    nid?: string;
    dob?: string;
    comment?: string;
    is_alive: boolean;
}

export interface WarisanCertificate {
    id: string;
    deceasedName: string;
    deceasedFatherName?: string;
    address: string;
    heirs: Heir[];
    certificateNumber: string;
    issueDate: string;
    applicantName?: string;
    applicantFatherName?: string;
    applicantAddress?: string;
    wardNo?: string;
    assistantName?: string;
    adminName?: string;
    municipalityName?: string;
    email?: string;
    logoUrl?: string;
    signatureUrl?: string;
    preparerSignatureUrl?: string;
}

// --- Trade Licence Types ---
export interface TradeLicenceFee {
    description: string;
    amount: number;
}

export interface TradeLicence extends WarisanCertificate {
    municipalityName: string;
    mayorName: string;
    executiveOfficerName: string;
    inspectorName: string;
    licenceNo: string;
    licenceId: string;
    wardNo: string;
    circle: string;
    issueDate: string;
    renewalYear: string;
    renewalDate: string;
    expiryYear: string;
    businessName: string;
    businessType: string;
    ownerName: string;
    fatherName: string;
    motherName: string;
    businessAddress: string;
    ownerPresentAddress: string;
    ownerPermanentAddress: string;
    nid: string;
    phone: string;
    tin: string;
    fees: TradeLicenceFee[];
    collection: TradeLicenceFee[];
    logoUrl?: string;
    photoUrl?: string;
    mayorSignatureUrl?: string;
    officerSignatureUrl?: string;
    inspectorSignatureUrl?: string;
}

// --- Tour Planner Types ---
export interface Friend {
  id: string;
  name: string;
  role?: 'manager' | 'member';
}

export interface Deposit {
  id: string;
  friendId: string;
  amount: number;
  createdAt: string; // ISO String
  accountId?: string;
  transactionId?: string;
}

export interface Estimate {
  id: string;
  description: string;
  amount: number;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  paidById: string; // 'manager', 'credit', or friendId
  paidFor: string[]; // friendIds or ['all']
  createdAt: string; // ISO String
  transactionId?: string;
  accountId?: string;
}

export interface Tour {
    id: string;
    name: string;
    createdAt: string; // ISO string
    friends: Friend[];
    deposits: Deposit[];
    expenses: Expense[];
    estimates?: Estimate[];
    managerBalance: number;
    partyId?: string; // Link to the main party system
}

export interface SmsTemplate {
    id: string;
    type: 'creditSale' | 'cashSale' | 'receivePayment' | 'givePayment' | 'paymentReminder' | 'creditSaleWithPartPayment' | 'cashSaleWithOverpayment';
    message: string;
}

export interface TradeLicenceField {
    id: string;
    label: string;
    order: number;
}

// --- Log Record ---
export interface LogRecord {
  id: string;
  date: string; // YYYY-MM-DD
  summary: {
    totalSales: number;
    totalPurchases: number;
    totalIncome: number;
    totalExpense: number;
    netCashFlow: number;
  };
  accountBalances: { id: string; name: string; balance: number }[];
  partyBalances: { id: string; name: string; balance: number }[];
  transactions: Transaction[];
}

export interface FitnessLog {
  id: string;
  date: string; // YYYY-MM-DD
  foods: { name: string; points: number; }[];
  total_points: number;
  walk_mins: number;
  user_id: string;
}

export interface FamilyRegistration {
  id: string;
  name: string;
  dob: string; // ISO string
  nid: string;
  fatherName: string;
  motherName: string;
  phone: string;
  createdAt: string; // ISO string
}
