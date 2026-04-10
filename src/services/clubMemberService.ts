

import { db } from '@/lib/firebase';
import type { ClubMember, SubscriptionHistory, MemberCategoryConfig } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp, serverTimestamp, runTransaction, getDocs
} from 'firebase/firestore';
import { format, addDays } from 'date-fns';

// Custom cleanUndefined that allows empty strings for specific fields like adminNotes
const cleanUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) {
        return undefined;
    }
    if (Array.isArray(obj)) {
        return obj.map(cleanUndefined).filter(v => v !== undefined);
    }
    if (typeof obj === 'object' && !Array.isArray(obj) && obj.constructor === Object) {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                // Keep 'adminNotes' even if it's an empty string
                if (key === 'adminNotes' && obj[key] === '') {
                   newObj[key] = '';
                   continue;
                }
                const value = cleanUndefined(obj[key]);
                if (value !== undefined) {
                    newObj[key] = value;
                }
            }
        }
        return newObj;
    }
    return obj;
};


const membersCollectionRef = () => db ? collection(db, 'eliteClubMembers') : null;

// Helper to convert Firestore Timestamps
const mapDocToMember = (doc: any): ClubMember => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        joinDate: (data.joinDate as Timestamp)?.toDate ? (data.joinDate as Timestamp).toDate().toISOString().split('T')[0] : data.joinDate,
        subscriptionEndDate: (data.subscriptionEndDate as Timestamp)?.toDate ? (data.subscriptionEndDate as Timestamp).toDate().toISOString().split('T')[0] : data.subscriptionEndDate,
        subscriptionHistory: (data.subscriptionHistory || []).map((h: any) => ({
            ...h,
            subscriptionDate: (h.subscriptionDate as Timestamp)?.toDate ? (h.subscriptionDate as Timestamp).toDate().toISOString().split('T')[0] : h.subscriptionDate,
            expiryDate: (h.expiryDate as Timestamp)?.toDate ? (h.expiryDate as Timestamp).toDate().toISOString().split('T')[0] : h.expiryDate,
        })),
        banUntil: (data.banUntil as Timestamp)?.toDate ? (data.banUntil as Timestamp).toDate().toISOString() : data.banUntil,
        bannedAt: (data.bannedAt as Timestamp)?.toDate ? (data.bannedAt as Timestamp).toDate().toISOString() : data.bannedAt,

    } as ClubMember;
};

// Subscribe to all members
export function subscribeToClubMembers(
  onUpdate: (members: ClubMember[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = membersCollectionRef();
  if (!collectionRef) {
      onError(new Error("Firebase not configured"));
      return () => {};
  }
  const q = query(collectionRef, orderBy('name', 'asc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToMember));
  }, (error) => onError(error as Error));
}

export function subscribeToClubMemberById(
    id: string,
    onUpdate: (member: ClubMember | null) => void,
    onError: (error: Error) => void
) {
    if (!db) {
        onError(new Error("Firebase not configured"));
        return () => {};
    }
    const docRef = doc(db, 'eliteClubMembers', id);
    return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            onUpdate(mapDocToMember(docSnap));
        } else {
            onUpdate(null);
        }
    }, (error) => onError(error as Error));
}


// Add a new member
export async function addClubMember(
    member: Omit<ClubMember, 'id'>, 
    categories: MemberCategoryConfig[], 
    allMembers: ClubMember[]
): Promise<string> {
    if(!db) throw new Error("Firebase not configured");

    const newMemberCategory = categories.find(c => c.name === member.memberCategory);
    const joiningFee = newMemberCategory?.joiningFee || 0;
    const subscriptionDays = newMemberCategory?.subscriptionDays || 365;

    await runTransaction(db, async (transaction) => {
        // --- Profit Distribution Logic ---
        if (joiningFee > 0) {
            // Determine if the new member is a profit-holder (excluding Founder for this check)
            const isNewMemberProfitHolder = (newMemberCategory?.profitPercentage || 0) > 0 && newMemberCategory?.name !== 'Founder';

            // Identify who is eligible to receive profits from this join.
            let eligibleProfitRecipients = allMembers.filter(m => {
                const category = categories.find(c => c.name === m.memberCategory);
                if (!category || category.profitPercentage <= 0) return false;

                // Founders are always eligible.
                if (m.memberCategory === 'Founder') return true;

                // If the new member is a profit holder, only Founders are eligible.
                if (isNewMemberProfitHolder) return false;

                // Other profit-holders are only eligible if they joined before the new member.
                const memberJoinDate = new Date(m.joinDate);
                const newMemberJoinDate = new Date(member.joinDate);
                return memberJoinDate < newMemberJoinDate;
            });
            
             // If there are no specific eligible recipients (e.g., a profit-holder joins first after founders), only founders get the profit.
            if (eligibleProfitRecipients.filter(m => m.memberCategory !== 'Founder').length === 0) {
                eligibleProfitRecipients = allMembers.filter(m => m.memberCategory === 'Founder' && (categories.find(c => c.name === 'Founder')?.profitPercentage || 0) > 0);
            }

            if (eligibleProfitRecipients.length > 0) {
                // Calculate the total percentage shares of only the eligible members
                const totalEligiblePercentage = eligibleProfitRecipients.reduce((sum, m) => {
                    const category = categories.find(c => c.name === m.memberCategory);
                    return sum + (category?.profitPercentage || 0);
                }, 0);

                if (totalEligiblePercentage > 0) {
                    for (const recipient of eligibleProfitRecipients) {
                        const recipientCategory = categories.find(c => c.name === recipient.memberCategory);
                        const recipientShare = (recipientCategory?.profitPercentage || 0) / totalEligiblePercentage;
                        const profitShare = joiningFee * recipientShare;
                        
                        if(profitShare > 0) {
                            const memberRef = doc(db, 'eliteClubMembers', recipient.id);
                            const currentProfit = recipient.profitBalance || 0;
                            transaction.update(memberRef, { profitBalance: currentProfit + profitShare });
                        }
                    }
                }
            }
        }
        
        // Add the new member
        const collectionRef = membersCollectionRef()!;
        const newMemberRef = doc(collectionRef);
        const memberId = `LEC-${Date.now().toString().slice(-6)}`;
        
        const joinDate = new Date(member.joinDate);
        const subscriptionEndDate = addDays(joinDate, subscriptionDays);

        const docData: Record<string, any> = {
            ...member,
            memberId, // Add auto-generated ID
            subscriptionEndDate: format(subscriptionEndDate, 'yyyy-MM-dd'),
            createdAt: serverTimestamp(),
            profitBalance: 0, // New members start with 0 profit
        };
        if (member.joinDate) docData.joinDate = new Date(member.joinDate);

        const cleanData = cleanUndefined(docData);
        transaction.set(newMemberRef, cleanData);
    });

    return 'success';
}


// Update an existing member
export async function updateClubMember(
    id: string, 
    member: Partial<Omit<ClubMember, 'id'>>,
    categories: MemberCategoryConfig[]
): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  
  await runTransaction(db, async (transaction) => {
    const docRef = doc(db, 'eliteClubMembers', id);
    const docSnap = await transaction.get(docRef);
    if (!docSnap.exists()) throw new Error("Member not found");
    
    const oldData = docSnap.data() as ClubMember;
    const oldCategoryName = oldData.memberCategory;
    const newCategoryName = member.memberCategory;

    // Check if category is changing and a joining fee applies
    if (newCategoryName && oldCategoryName !== newCategoryName) {
        const newCategory = categories.find(c => c.name === newCategoryName);
        const joiningFee = newCategory?.joiningFee || 0;

        if (joiningFee > 0) {
            const allMembersSnap = await getDocs(query(collection(db, 'eliteClubMembers')));
            for (const memberDoc of allMembersSnap.docs) {
                if (memberDoc.id === id) continue; // Don't give profit to the member being updated
                
                const existingMember = memberDoc.data() as ClubMember;
                const memberCategory = categories.find(c => c.name === existingMember.memberCategory);

                if (memberCategory && memberCategory.profitPercentage > 0) {
                    const profitShare = (joiningFee * memberCategory.profitPercentage) / 100;
                    const memberRef = doc(db, 'eliteClubMembers', memberDoc.id);
                    const currentProfit = existingMember.profitBalance || 0;
                    transaction.update(memberRef, { profitBalance: currentProfit + profitShare });
                }
            }
        }
    }

    // Prepare update data for the target member
    const dataToUpdate: Record<string, any> = { ...member };
    if (member.joinDate) dataToUpdate.joinDate = new Date(member.joinDate);
    if (member.subscriptionEndDate) dataToUpdate.subscriptionEndDate = new Date(member.subscriptionEndDate);
    if (member.banUntil) dataToUpdate.banUntil = new Date(member.banUntil);
    if (member.subscriptionHistory) {
      dataToUpdate.subscriptionHistory = member.subscriptionHistory.map(h => ({
          ...h,
          subscriptionDate: new Date(h.subscriptionDate),
          expiryDate: new Date(h.expiryDate),
      }));
    }
    delete (dataToUpdate as any).createdAt;
    const cleanData = cleanUndefined(dataToUpdate);
    transaction.update(docRef, cleanData);
  });
}

// Delete a member
export async function deleteClubMember(id: string): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const docRef = doc(db, 'eliteClubMembers', id);
  await deleteDoc(docRef);
}
