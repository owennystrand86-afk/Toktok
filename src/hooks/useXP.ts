import { doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { soundManager } from '../utils';

export function useXP() {
  const addXP = async (amount: number) => {
    if (!auth.currentUser) return;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const currentXP = data.xp || 0;
        const currentLevel = data.level || 1;
        const newXP = currentXP + amount;
        
        // Simple level formula: level * 1000 XP per level
        const xpForNextLevel = currentLevel * 1000;
        
        if (newXP >= xpForNextLevel) {
          // Level Up!
          await updateDoc(userRef, {
            xp: newXP - xpForNextLevel,
            level: increment(1),
            coins: increment(currentLevel * 100) // Bonus coins on level up
          });
          soundManager.play('levelUp');
          return true; // Levelled up
        } else {
          await updateDoc(userRef, {
            xp: increment(amount)
          });
          return false;
        }
      }
    } catch (error) {
      console.error("Error adding XP:", error);
    }
    return false;
  };

  return { addXP };
}
