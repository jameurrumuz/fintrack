
import { db } from '@/lib/firebase';
import type { ChatMessage, ChatThread } from '@/types';
import { 
  collection, doc, onSnapshot, setDoc, updateDoc, arrayUnion, serverTimestamp, getDoc, Timestamp
} from 'firebase/firestore';

const chatsCollectionRef = () => db ? collection(db, 'chats') : null;

export function subscribeToChatThread(
  partyId: string,
  onUpdate: (thread: ChatThread | null) => void,
  onError: (error: Error) => void
): () => void {
  if (!db) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  const threadDocRef = doc(db, 'chats', partyId);

  const unsubscribe = onSnapshot(threadDocRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const messages = (data.messages || []).map((msg: any) => ({
        ...msg,
        timestamp: (msg.timestamp as Timestamp)?.toDate ? (msg.timestamp as Timestamp).toDate().toISOString() : msg.timestamp,
      }));
      onUpdate({ ...data, id: docSnap.id, messages } as ChatThread);
    } else {
      onUpdate(null);
    }
  }, (error) => {
    console.error(`Error listening to chat thread for party ${partyId}:`, error);
    onError(error);
  });

  return unsubscribe;
}

export async function sendMessage(
  partyId: string,
  partyName: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): Promise<void> {
  if (!db) throw new Error('Firebase not configured.');
  const threadDocRef = doc(db, 'chats', partyId);
  
  const newMessage: ChatMessage = {
    ...message,
    id: `msg-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  const docSnap = await getDoc(threadDocRef);
  const isAdminSender = message.senderId === 'admin';

  if (docSnap.exists()) {
    // If admin sends, user has unread. If user sends, admin has unread.
    const updateData = {
        messages: arrayUnion(newMessage),
        lastUpdatedAt: serverTimestamp(),
        ...(isAdminSender ? { hasUnreadUserMessages: true } : { hasUnreadAdminMessages: true })
    };
    await updateDoc(threadDocRef, updateData);
  } else {
    // Create new thread
    const newThread: Omit<ChatThread, 'id' | 'lastUpdatedAt'> = {
        partyName,
        messages: [newMessage],
        hasUnreadAdminMessages: !isAdminSender,
        hasUnreadUserMessages: isAdminSender,
    };
    await setDoc(threadDocRef, {
        ...newThread,
        lastUpdatedAt: serverTimestamp(),
    });
  }
}

export async function markMessagesAsRead(partyId: string, viewer: 'admin' | 'user'): Promise<void> {
  if (!db) throw new Error('Firebase not configured.');
  const threadDocRef = doc(db, 'chats', partyId);
  const docSnap = await getDoc(threadDocRef);

  if (docSnap.exists()) {
    if (viewer === 'admin' && docSnap.data().hasUnreadAdminMessages) {
      await updateDoc(threadDocRef, { hasUnreadAdminMessages: false });
    } else if (viewer === 'user' && docSnap.data().hasUnreadUserMessages) {
      await updateDoc(threadDocRef, { hasUnreadUserMessages: false });
    }
  }
}
