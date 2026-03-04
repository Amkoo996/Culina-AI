/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Utensils, 
  ChefHat, 
  ShoppingCart, 
  Plus, 
  Trash2, 
  X, 
  ChevronRight, 
  Flame, 
  Clock,
  CheckCircle2,
  Search,
  Grid,
  ChevronDown,
  ChevronUp,
  Home,
  User,
  Camera,
  Wallet,
  MessageSquare,
  TrendingUp,
  Activity,
  Calculator,
  PlusCircle,
  History,
  Droplets,
  Footprints,
  Zap,
  Crown,
  Star,
  ShieldCheck,
  Info,
  FileText,
  Shield,
  Lock,
  Scale,
  Smartphone,
  Dumbbell,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { INGREDIENT_CATEGORIES, ALL_INGREDIENTS, INGREDIENT_SYNONYMS } from './ingredients';
import { LEGAL_CONTENT } from './legalContent';

// --- Types ---

interface UserProfile {
  height: number;
  weight: number;
  age: number;
  activity: 'sedentary' | 'moderate' | 'active';
  goal: 'lose' | 'maintain' | 'gain';
  subscription: 'basic' | 'plus' | 'premium';
  mealPlan?: Record<string, Recipe[]>;
  firstName?: string;
  lastName?: string;
  address?: string;
  phone?: string;
}

interface DailyStats {
  steps: number;
  water: number; // in ml
  caloriesBurned: number;
}

interface BudgetItem {
  id: string;
  name: string;
  amount: number;
  date: string;
}

interface InventoryItem {
  id: string;
  name: string;
  displayName: string;
  qty: string;
}

interface GroceryItem {
  id: string;
  name: string;
  fromRecipe?: string;
}

interface Recipe {
  name_bs: string;
  time: number;
  ingredients: string[];
  instructions_bs: string[];
  nutrition: {
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

type Tab = 'home' | 'fridge' | 'meals' | 'grocery' | 'profile';

// --- Constants ---

const DAILY_LIMIT = 50;

export default function App() {
  // --- State ---
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('profile');
    return saved ? JSON.parse(saved) : { 
      height: 175, 
      weight: 75, 
      age: 30, 
      activity: 'moderate', 
      goal: 'maintain',
      subscription: 'basic'
    };
  });
  const [user, setUser] = useState<{ id: number; email: string; firstName?: string; lastName?: string; address?: string; phone?: string } | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authFirstName, setAuthFirstName] = useState('');
  const [authLastName, setAuthLastName] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [authPostcode, setAuthPostcode] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);

  // Payment states
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [paymentStep, setPaymentStep] = useState<'options' | 'card'>('options');

  const [stats, setStats] = useState<DailyStats>(() => {
    const saved = localStorage.getItem('dailyStats');
    const today = new Date().toDateString();
    const data = saved ? JSON.parse(saved) : {};
    return data.date === today ? data.stats : { steps: 0, water: 0, caloriesBurned: 0 };
  });
  const [budget, setBudget] = useState<BudgetItem[]>(() => {
    const saved = localStorage.getItem('budget');
    return saved ? JSON.parse(saved) : [];
  });
  const [inventory, setInventory] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('inventory');
    return saved ? JSON.parse(saved) : [];
  });
  const [grocery, setGrocery] = useState<GroceryItem[]>(() => {
    const saved = localStorage.getItem('grocery');
    return saved ? JSON.parse(saved) : [];
  });
  const [suggestionCount, setSuggestionCount] = useState<number>(() => {
    const saved = localStorage.getItem('suggestionCount');
    return saved ? parseInt(saved) : 0;
  });
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [currentRecipes, setCurrentRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showMealPlanSelector, setShowMealPlanSelector] = useState<{ recipe: Recipe } | null>(null);

  // Autocomplete states
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCategoryBrowser, setShowCategoryBrowser] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showLegalModal, setShowLegalModal] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<{ plan: string } | null>(null);

  // Form states
  const [ingName, setIngName] = useState('');
  const [ingQty, setIngQty] = useState('');
  const [ingUnit, setIngUnit] = useState('g');

  // Budget states
  const [budgetName, setBudgetName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');

  // Filter states
  const [weightGoal, setWeightGoal] = useState('balanced');
  const [filterTime, setFilterTime] = useState(30);
  const [isVeg, setIsVeg] = useState(false);
  const [exclusions, setExclusions] = useState<string[]>([]);

  // --- Effects ---
  useEffect(() => {
    const checkUser = async () => {
      try {
        const res = await fetch('/api/user/me');
        if (res.ok) {
          const data = await res.json();
          setUser({ 
            id: data.id, 
            email: data.email, 
            firstName: data.firstName, 
            lastName: data.lastName, 
            address: data.address, 
            phone: data.phone 
          });
          if (data.profile) setProfile(JSON.parse(data.profile));
          if (data.stats) setStats(JSON.parse(data.stats));
          if (data.budget) setBudget(JSON.parse(data.budget));
          if (data.inventory) setInventory(JSON.parse(data.inventory));
          if (data.grocery) setGrocery(JSON.parse(data.grocery));
        }
      } catch (e) {
        console.error("Auth check failed", e);
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      const sync = async () => {
        await fetch('/api/user/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile, stats, budget, inventory, grocery })
        });
      };
      const timer = setTimeout(sync, 2000);
      return () => clearTimeout(timer);
    }
  }, [profile, stats, budget, inventory, grocery, user]);

  // --- Step Tracking Sensor Logic ---
  useEffect(() => {
    let lastAccel = 0;
    const threshold = 12;

    const handleMotion = (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel) return;
      
      const magnitude = Math.sqrt((accel.x || 0)**2 + (accel.y || 0)**2 + (accel.z || 0)**2);
      const delta = Math.abs(magnitude - lastAccel);
      
      if (delta > threshold) {
        addSteps(1);
      }
      lastAccel = magnitude;
    };

    if (typeof DeviceMotionEvent !== 'undefined' && (DeviceMotionEvent as any).requestPermission) {
      // iOS 13+ requires permission
    } else {
      window.addEventListener('devicemotion', handleMotion);
    }

    return () => window.removeEventListener('devicemotion', handleMotion);
  }, []);

  useEffect(() => {
    localStorage.setItem('profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('dailyStats', JSON.stringify({
      date: new Date().toDateString(),
      stats
    }));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('budget', JSON.stringify(budget));
  }, [budget]);

  useEffect(() => {
    if (ingName.length > 1) {
      const filtered = ALL_INGREDIENTS.filter(i => 
        i.toLowerCase().includes(ingName.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [ingName]);

  useEffect(() => {
    if (authAddress.length > 2 && authMode === 'register') {
      const BIH_ADDRESSES = [
        "Maršala Tita 1, Sarajevo",
        "Ferhadija 10, Sarajevo",
        "Zmaja od Bosne 7, Sarajevo",
        "Kralja Tvrtka 5, Banja Luka",
        "Veselina Masleše 1, Banja Luka",
        "Bulevar Narodne Revolucije 1, Mostar",
        "Kneza Branimira 10, Mostar",
        "Trg Alije Izetbegovića 1, Zenica",
        "Školska 10, Zenica",
        "Turalibegova 1, Tuzla",
        "Maršala Tita 10, Tuzla"
      ];
      const filtered = BIH_ADDRESSES.filter(a => 
        a.toLowerCase().includes(authAddress.toLowerCase())
      );
      setAddressSuggestions(filtered);
      setShowAddressSuggestions(true);
    } else {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
    }
  }, [authAddress, authMode]);

  const toggleExclusion = (item: string) => {
    setExclusions(prev => 
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );
  };

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('grocery', JSON.stringify(grocery));
  }, [grocery]);

  useEffect(() => {
    localStorage.setItem('suggestionCount', suggestionCount.toString());
  }, [suggestionCount]);

  // --- Handlers ---

  const addInventory = () => {
    if (ingName && ingQty) {
      const newItem: InventoryItem = {
        id: crypto.randomUUID(),
        name: ingName.toLowerCase(),
        displayName: ingName,
        qty: ingQty + ingUnit
      };
      setInventory([...inventory, newItem]);
      setIngName('');
      setIngQty('');
    }
  };

  const removeInventory = (id: string) => {
    setInventory(inventory.filter(item => item.id !== id));
  };

  const removeGrocery = (id: string) => {
    const item = grocery.find(i => i.id === id);
    if (item) {
      // Add to inventory when bought
      const newItem: InventoryItem = {
        id: crypto.randomUUID(),
        name: item.name.toLowerCase(),
        displayName: item.name,
        qty: "Kupljeno"
      };
      setInventory(prev => [...prev, newItem]);
    }
    setGrocery(grocery.filter(item => item.id !== id));
  };

  const addBudget = () => {
    if (budgetName && budgetAmount) {
      const newItem: BudgetItem = {
        id: crypto.randomUUID(),
        name: budgetName,
        amount: parseFloat(budgetAmount),
        date: new Date().toLocaleDateString()
      };
      setBudget([newItem, ...budget]);
      setBudgetName('');
      setBudgetAmount('');
    }
  };

  const removeBudget = (id: string) => {
    setBudget(budget.filter(item => item.id !== id));
  };

  const calculateBMI = () => {
    if (!profile.height || !profile.weight || isNaN(profile.height) || isNaN(profile.weight)) return '0.0';
    const h = profile.height / 100;
    if (h === 0) return '0.0';
    const bmi = profile.weight / (h * h);
    return isFinite(bmi) ? bmi.toFixed(1) : '0.0';
  };

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Pothranjenost', color: 'text-blue-400', bg: 'bg-blue-400' };
    if (bmi < 25) return { label: 'Normalna težina', color: 'text-emerald-400', bg: 'bg-emerald-400' };
    if (bmi < 30) return { label: 'Prekomjerna težina', color: 'text-amber-400', bg: 'bg-amber-400' };
    return { label: 'Gojaznost', color: 'text-red-400', bg: 'bg-red-400' };
  };

  const getRecommendedWeight = () => {
    if (!profile.height || isNaN(profile.height)) return { min: 0, max: 0 };
    const h = profile.height / 100;
    const min = 18.5 * (h * h);
    const max = 24.9 * (h * h);
    return { min: Math.round(min), max: Math.round(max) };
  };

  const addWater = (amount: number) => {
    setStats(prev => ({ ...prev, water: Math.max(0, prev.water + amount) }));
  };

  const addSteps = (amount: number) => {
    setStats(prev => ({ 
      ...prev, 
      steps: prev.steps + amount,
      caloriesBurned: prev.caloriesBurned + (amount * 0.04) // Rough estimate
    }));
  };

  const addToMealPlan = (day: string, recipe: Recipe) => {
    if (profile.subscription === 'basic') {
      alert("Planer obroka je dostupan samo za Plus i Premium korisnike!");
      return;
    }
    const newPlan = { ...profile.mealPlan };
    if (!newPlan[day]) newPlan[day] = [];
    newPlan[day].push(recipe);
    setProfile({ ...profile, mealPlan: newPlan });
    alert(`Recept dodan u plan za ${day}!`);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login' 
      ? { email: authEmail, password: authPassword }
      : { 
          email: authEmail, 
          password: authPassword, 
          firstName: authFirstName, 
          lastName: authLastName, 
          address: authAddress, 
          postcode: authPostcode,
          phone: authPhone 
        };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setShowAuth(false);
      } else {
        alert("Greška pri prijavi/registraciji");
      }
    } catch (e) {
      alert("Serverska greška");
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.reload();
  };

  const handleSubscription = async (plan: string) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    if (plan === 'basic') {
      setProfile(prev => ({ ...prev, subscription: 'basic' }));
      return;
    }
    setShowPaymentModal({ plan });
  };

  const cookRecipe = (recipe: Recipe) => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    // Check if all ingredients are in inventory
    const missing: string[] = [];
    const newInventory = [...inventory];

    recipe.ingredients.forEach(ing => {
      const foundIndex = newInventory.findIndex(item => 
        ing.toLowerCase().includes(item.name.toLowerCase()) || 
        item.name.toLowerCase().includes(ing.toLowerCase())
      );
      
      if (foundIndex === -1) {
        missing.push(ing);
      } else {
        // In a real app we'd parse quantities, here we just remove the item
        newInventory.splice(foundIndex, 1);
      }
    });

    if (missing.length > 0) {
      alert(`Nedostaju vam sljedeći sastojci: ${missing.join(', ')}. Dodajte ih u korpu prvo!`);
      return;
    }

    setInventory(newInventory);
    alert(`Uspješno ste pripremili ${recipe.name_bs}! Sastojci su skinuti iz frižidera.`);
  };

  const scanProduct = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              inlineData: {
                data: base64Data,
                mimeType: file.type
              }
            },
            {
              text: "Analiziraj ovaj prehrambeni proizvod. Vrati JSON sa: 'name' (naziv), 'calories' (kcal na 100g), 'protein', 'carbs', 'fat'. Odgovori isključivo JSON-om."
            }
          ],
          config: { responseMimeType: "application/json" }
        });
        
        const data = JSON.parse(response.text || "{}");
        alert(`Skenirano: ${data.name || 'Proizvod'}\nKalorije: ${data.calories || '?'} kcal\nProteini: ${data.protein || '?'}g`);
        
        // Optionally add to inventory
        if (data.name && confirm(`Želite li dodati ${data.name} u frižider?`)) {
          const newItem: InventoryItem = {
            id: crypto.randomUUID(),
            name: data.name.toLowerCase(),
            displayName: data.name,
            qty: "100g"
          };
          setInventory(prev => [...prev, newItem]);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error(e);
      alert("Greška pri analizi slike.");
    } finally {
      setScanning(false);
    }
  };

  const suggestMeals = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }
    
    // Check cache first (simulated)
    const cached = localStorage.getItem(`recipe_cache_${isVeg}_${filterTime}`);
    if (cached && Math.random() > 0.5) { // 50% chance to use cache for demo
      setCurrentRecipes(JSON.parse(cached));
      return;
    }

    const limit = profile.subscription === 'premium' ? 200 : profile.subscription === 'plus' ? 100 : DAILY_LIMIT;
    if (suggestionCount >= limit) {
      alert(`Dostigli ste dnevni limit od ${limit} upita. Nadogradite profil za više kvota!`);
      return;
    }

    setLoading(true);
    const hasInventory = inventory.length > 0;
    const ingredientsList = hasInventory ? inventory.map(i => i.name).join(', ') : 'bilo šta (korisnik nema specifičnih sastojaka pri ruci)';
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const bmi = calculateBMI();
    const prompt = `Ti si Culina AI, vrhunski nutricionista i kuhar. 
    Korisnički profil: Visina ${profile.height}cm, Težina ${profile.weight}kg, BMI ${bmi}.
    Cilj: ${profile.goal === 'lose' ? 'Gubitak kilograma' : profile.goal === 'gain' ? 'Dobitak mišića' : 'Održavanje težine'}.
    Nivo aktivnosti: ${profile.activity}.
    
    ${hasInventory ? `Korisnik ima ove sastojke: ${ingredientsList}.` : 'Korisnik nema unesenih sastojaka, predloži nešto kreativno i popularno.'}
    Cilj ishrane: ${weightGoal}. 
    Maksimalno vrijeme pripreme: ${filterTime} minuta.
    ${isVeg ? 'Recept MORA biti vegetarijanski.' : ''}
    ${exclusions.length > 0 ? `STROGO IZBJEGAVAJ sljedeće (alergeni ili neželjene namirnice): ${exclusions.join(', ')}.` : ''}
    
    Generiši 3 kreativna i zdrava recepta na bosanskom jeziku koji su prilagođeni korisnikovom BMI i cilju.
    Vrati odgovor isključivo u JSON formatu prema šemi.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name_bs: { type: Type.STRING },
                time: { type: Type.INTEGER },
                ingredients: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING } 
                },
                instructions_bs: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING } 
                },
                nutrition: {
                  type: Type.OBJECT,
                  properties: {
                    calories: { type: Type.INTEGER },
                    protein: { type: Type.INTEGER },
                    carbs: { type: Type.INTEGER },
                    fat: { type: Type.INTEGER }
                  },
                  required: ["calories"]
                }
              },
              required: ["name_bs", "time", "ingredients", "instructions_bs", "nutrition"]
            }
          }
        }
      });

      const recipes = JSON.parse(response.text || "[]");
      setCurrentRecipes(recipes);
      setSuggestionCount(prev => prev + 1);
    } catch (error) {
      console.error("AI Error:", error);
      alert("Došlo je do greške prilikom generisanja recepata. Pokušajte ponovo.");
    } finally {
      setLoading(false);
    }
  };

  const addMissingToGrocery = (recipe: Recipe) => {
    const newItems: GroceryItem[] = [];
    recipe.ingredients.forEach(ing => {
      const cleanIng = ing.toLowerCase();
      
      // Improved matching logic:
      const exists = inventory.some(inv => {
        const invName = inv.name.toLowerCase();
        
        // 1. Direct match or substring
        if (cleanIng.includes(invName) || invName.includes(cleanIng)) return true;
        
        // 2. Synonym match
        const synonyms = INGREDIENT_SYNONYMS[invName] || [];
        if (synonyms.some(syn => cleanIng.includes(syn.toLowerCase()))) return true;

        // 3. Reverse synonym match (if recipe ingredient is a synonym for something in inventory)
        for (const [key, syns] of Object.entries(INGREDIENT_SYNONYMS)) {
          if (syns.some(s => cleanIng.includes(s.toLowerCase())) && invName === key.toLowerCase()) {
            return true;
          }
        }
        
        return false;
      });
      
      if (!exists) {
        newItems.push({
          id: crypto.randomUUID(),
          name: ing,
          fromRecipe: recipe.name_bs
        });
      }
    });

    if (newItems.length > 0) {
      setGrocery(prev => [...prev, ...newItems]);
      alert(`Dodano ${newItems.length} sastojaka u listu za kupovinu.`);
    } else {
      alert("Svi sastojci su već u tvojoj kuhinji!");
    }
    setSelectedRecipe(null);
    setActiveTab('grocery');
  };

  // --- Render Helpers ---

  return (
    <div className="max-w-2xl mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <header className="p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <ChefHat className="text-slate-900 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">
              Culina<span className="text-emerald-400">AI</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Smart Nutrition</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-[10px] bg-slate-800 px-3 py-1 rounded-full border border-slate-700 text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-400" />
            AI: {suggestionCount}/{profile.subscription === 'premium' ? 200 : profile.subscription === 'plus' ? 100 : DAILY_LIMIT}
          </div>
          {profile.subscription !== 'basic' && (
            <div className="text-[8px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
              <Crown className="w-2 h-2" /> {profile.subscription}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 flex-1 pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.section 
              key="home"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              {/* BMI Dashboard */}
              <div className="glass p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/20">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-400" />
                      Zdravstveni Status
                    </h3>
                    <p className="text-xs text-slate-400">Tvoj trenutni napredak</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-3xl font-black ${getBMICategory(parseFloat(calculateBMI())).color}`}>
                      {calculateBMI()}
                    </div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest ${getBMICategory(parseFloat(calculateBMI())).color}`}>
                      {getBMICategory(parseFloat(calculateBMI())).label}
                    </div>
                  </div>
                </div>
                
                {/* BMI Progress Bar */}
                <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden flex mb-6">
                  <div className="h-full bg-blue-400" style={{ width: '18.5%' }}></div>
                  <div className="h-full bg-emerald-400" style={{ width: '6.5%' }}></div>
                  <div className="h-full bg-amber-400" style={{ width: '5%' }}></div>
                  <div className="h-full bg-red-400" style={{ width: '70%' }}></div>
                  {/* Indicator */}
                  <motion.div 
                    initial={{ left: 0 }}
                    animate={{ left: `${Math.min(Math.max((parseFloat(calculateBMI()) / 40) * 100, 0), 100)}%` }}
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_rgba(255,255,255,1)] z-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 p-3 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Težina</div>
                    <div className="text-sm font-bold">{profile.weight} kg</div>
                  </div>
                  <div className="bg-slate-800/50 p-3 rounded-2xl border border-white/5">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Idealna Težina</div>
                    <div className="text-sm font-bold text-emerald-400">{getRecommendedWeight().min} - {getRecommendedWeight().max} kg</div>
                  </div>
                </div>

                {parseFloat(calculateBMI()) >= 25 && (
                  <div className="mt-4 p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                    <p className="text-[10px] text-amber-200 leading-relaxed">
                      <Info className="w-3 h-3 inline mr-1 mb-0.5 text-amber-400" />
                      Tvoj BMI je povišen ({calculateBMI()}). Za tvoju visinu od {profile.height}cm, preporučena zdrava težina je između 
                      <span className="text-white font-bold"> {getRecommendedWeight().min}kg </span> i 
                      <span className="text-white font-bold"> {getRecommendedWeight().max}kg</span>.
                    </p>
                  </div>
                )}
              </div>

              {/* Activity Tracker (Steps & Water) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass p-5 rounded-3xl border-blue-500/10">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-2xl flex items-center justify-center">
                      <Footprints className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-[8px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full font-bold uppercase">Auto-Track</div>
                  </div>
                  <div className="text-2xl font-black text-white">{stats.steps}</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Koraka danas</div>
                  <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400" style={{ width: `${Math.min((stats.steps / 10000) * 100, 100)}%` }}></div>
                  </div>
                </div>

                <div className="glass p-5 rounded-3xl border-cyan-500/10">
                  <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 bg-cyan-500/20 rounded-2xl flex items-center justify-center">
                      <Droplets className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => addWater(-250)} className="p-1 hover:bg-white/5 rounded-lg">
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                      <button onClick={() => addWater(250)} className="p-1 hover:bg-white/5 rounded-lg">
                        <PlusCircle className="w-4 h-4 text-cyan-400" />
                      </button>
                    </div>
                  </div>
                  <div className="text-2xl font-black text-white">{stats.water} ml</div>
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Voda (cilj 2.5L)</div>
                  <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-cyan-400" style={{ width: `${Math.min((stats.water / 2500) * 100, 100)}%` }}></div>
                  </div>
                </div>

                <div className="glass p-5 rounded-3xl border-amber-500/10 col-span-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                        <Zap className="w-6 h-6 text-amber-400" />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white">{Math.round(stats.caloriesBurned)} kcal</div>
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Potrošene kalorije (aktivnost)</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-slate-400">Danas</div>
                      <div className="text-[10px] text-amber-400 font-black uppercase">Aktivno</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nutrition Insights (Plus/Premium) */}
              {profile.subscription !== 'basic' && (
                <div className="glass p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-400" />
                    Nutritivni Uvidi
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Preporučeni unos kalorija</span>
                      <span className="text-xs font-bold text-white">2,450 kcal</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Proteini (cilj)</span>
                      <span className="text-xs font-bold text-white">160g</span>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                      <p className="text-[10px] text-amber-200 leading-relaxed">
                        <Info className="w-3 h-3 inline mr-1 mb-0.5" />
                        Na osnovu tvojih koraka ({stats.steps}), danas možeš unijeti dodatnih 200 kcal bez uticaja na tvoj cilj mršavljenja.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab('meals')}
                  className="glass p-6 rounded-3xl flex flex-col items-center gap-3 hover:bg-emerald-500/10 transition-colors border-emerald-500/10"
                >
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                    <ChefHat className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider">Novi Recept</span>
                </button>
                <div className="relative">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    onChange={scanProduct}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    disabled={scanning}
                  />
                  <button 
                    className="w-full h-full glass p-6 rounded-3xl flex flex-col items-center gap-3 hover:bg-cyan-500/10 transition-colors border-cyan-500/10"
                  >
                    <div className="w-12 h-12 bg-cyan-500/20 rounded-2xl flex items-center justify-center">
                      <Camera className={`w-6 h-6 text-cyan-400 ${scanning ? 'animate-pulse' : ''}`} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {scanning ? 'Skeniranje...' : 'Skeniraj Proizvod'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Daily Tip / Community */}
              <div className="glass p-6 rounded-3xl border-slate-700">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  Savjet dana
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "Pijte čašu mlake vode sa limunom svako jutro na prazan stomak kako biste ubrzali metabolizam i detoksikovali organizam."
                </p>
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center text-[8px] font-bold">
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                    <div className="w-6 h-6 rounded-full border-2 border-slate-900 bg-emerald-500 flex items-center justify-center text-[8px] font-bold text-slate-900">
                      +12
                    </div>
                  </div>
                  <button className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                    Zajednica →
                  </button>
                </div>
              </div>

              {/* Footer with Legal Links */}
              <footer className="mt-12 pt-8 border-t border-white/5 pb-8">
                <div className="flex flex-wrap justify-center gap-4 mb-4">
                  <button onClick={() => setShowLegalModal('terms')} className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors">Uslovi korištenja</button>
                  <button onClick={() => setShowLegalModal('privacy')} className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors">Privatnost</button>
                  <button onClick={() => setShowLegalModal('security')} className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors">Sigurnost</button>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest">© 2024 Culina AI • Sarajevo, BiH</p>
                  <p className="text-[8px] text-slate-700 mt-1">Svi podaci su zaštićeni u skladu sa zakonima BiH</p>
                </div>
              </footer>
            </motion.section>
          )}

          {activeTab === 'fridge' && (
            <motion.section 
              key="fridge"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="glass p-6 rounded-3xl relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Utensils className="w-5 h-5 text-emerald-500" />
                    Šta imaš u kuhinji?
                  </h3>
                  <button 
                    onClick={() => setShowCategoryBrowser(true)}
                    className="text-[10px] bg-emerald-500/10 text-emerald-500 px-3 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Grid className="w-3 h-3" /> Pregledaj kategorije
                  </button>
                </div>
                
                <div className="space-y-3">
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                      <Search className="w-4 h-4" />
                    </div>
                    <input 
                      type="text" 
                      value={ingName}
                      onChange={(e) => setIngName(e.target.value)}
                      onFocus={() => ingName.length > 1 && setShowSuggestions(true)}
                      placeholder="Naziv (npr. Piletina)" 
                      className="input-field w-full p-4 pl-11 rounded-2xl"
                    />
                    
                    {/* Autocomplete Suggestions */}
                    <AnimatePresence>
                      {showSuggestions && suggestions.length > 0 && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute left-0 right-0 top-full mt-2 glass rounded-2xl overflow-hidden z-50 shadow-2xl border border-white/10"
                        >
                          {suggestions.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => {
                                setIngName(s);
                                setShowSuggestions(false);
                              }}
                              className="w-full p-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-sm"
                            >
                              {s}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={ingQty}
                      onChange={(e) => setIngQty(e.target.value)}
                      placeholder="Kol." 
                      className="input-field flex-1 p-4 rounded-2xl"
                    />
                    <select 
                      value={ingUnit}
                      onChange={(e) => setIngUnit(e.target.value)}
                      className="input-field w-24 p-4 rounded-2xl"
                    >
                      <option>g</option>
                      <option>kg</option>
                      <option>kom</option>
                      <option>ml</option>
                      <option>l</option>
                    </select>
                  </div>
                  <button 
                    onClick={addInventory}
                    className="btn-primary w-full py-4 rounded-2xl mt-2 flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    DODAJ SASTOJAK
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {inventory.length === 0 ? (
                  <p className="text-center text-slate-500 py-10 italic">Frižider je prazan...</p>
                ) : (
                  inventory.map((item) => (
                    <motion.div 
                      layout
                      key={item.id}
                      className="glass p-4 rounded-2xl flex justify-between items-center"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="font-bold text-amber-400 truncate">{item.displayName}</div>
                        <div className="text-xs text-slate-400">{item.qty}</div>
                      </div>
                      <button 
                        onClick={() => removeInventory(item.id)}
                        className="bg-red-500/10 text-red-500 p-2 rounded-xl hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.section>
          )}

          {activeTab === 'meals' && (
            <motion.section 
              key="meals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="glass p-6 rounded-3xl">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-emerald-500" />
                  Pronađi savršen obrok
                </h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest ml-1 mb-2 block">Cilj ishrane</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['balanced', 'lose weight', 'gain weight', 'high protein'].map((goal) => (
                        <button
                          key={goal}
                          onClick={() => setWeightGoal(goal)}
                          className={`p-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                            weightGoal === goal 
                              ? 'bg-emerald-500 border-emerald-500 text-slate-900' 
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          {goal === 'balanced' ? 'Balansirano' : goal === 'lose weight' ? 'Mršavljenje' : goal === 'gain weight' ? 'Mišići' : 'Proteini'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest ml-1 mb-2 block">Vrijeme pripreme</label>
                    <div className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                      <Clock className="w-5 h-5 text-emerald-400 shrink-0" />
                      <input 
                        type="range" 
                        min="10" 
                        max="120" 
                        step="5"
                        value={filterTime}
                        onChange={(e) => setFilterTime(parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
                      />
                      <span className="text-sm font-black text-white min-w-[60px] text-right">{filterTime} min</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-5 h-5 text-emerald-400" />
                      <span className="text-xs font-bold">Samo vegetarijanski</span>
                    </div>
                    <button 
                      onClick={() => setIsVeg(!isVeg)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${isVeg ? 'bg-emerald-500' : 'bg-slate-700'}`}
                    >
                      <motion.div 
                        animate={{ x: isVeg ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 bg-white rounded-full"
                      />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest ml-1 mb-2 block">Izbaci sastojke</label>
                    <div className="flex flex-wrap gap-2">
                      {['Svinjetina', 'Janjetina', 'Orašasti', 'Mlijeko', 'Gluten', 'Plodovi mora', 'Jaja'].map((item) => (
                        <button
                          key={item}
                          onClick={() => toggleExclusion(item)}
                          className={`text-[10px] px-4 py-2 rounded-xl border transition-all ${
                            exclusions.includes(item) 
                              ? 'bg-red-500/20 border-red-500 text-red-400' 
                              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={suggestMeals}
                    disabled={loading}
                    className="btn-primary w-full py-5 rounded-2xl font-black text-lg tracking-wide disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/20"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900"></span>
                        KUHAR RAZMIŠLJA...
                      </span>
                    ) : 'GENERIŠI RECEPTE'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {currentRecipes.map((r, idx) => (
                  <motion.div 
                    key={idx}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedRecipe(r)}
                    className="glass p-5 rounded-3xl cursor-pointer hover:border-amber-500/30 transition-colors group"
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-extrabold text-xl text-amber-400 group-hover:text-amber-300 transition-colors">{r.name_bs}</h4>
                      <span className="text-xs bg-slate-700 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {r.time} min
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Sadrži {r.ingredients.length} sastojaka</p>
                    <div className="mt-4 flex justify-between items-center text-sm">
                      <span className="text-slate-300 flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-500" /> {r.nutrition?.calories || '?'} kcal
                      </span>
                      <span className="text-amber-500 font-bold text-xs uppercase tracking-widest flex items-center gap-1">
                        Pogledaj recept <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </motion.div>
                ))}

                {/* Meal Plan Display */}
                {profile.mealPlan && Object.keys(profile.mealPlan).length > 0 && (
                  <div className="mt-8 space-y-4">
                    <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest px-2 flex items-center gap-2">
                      <ChefHat className="w-3 h-3" /> Tvoj Plan Obroka
                    </h4>
                    {Object.entries(profile.mealPlan).map(([day, recipes]) => (
                      <div key={day} className="glass p-4 rounded-3xl border-white/5">
                        <div className="text-[10px] font-black uppercase text-slate-500 mb-3 ml-1">{day}</div>
                        <div className="space-y-2">
                          {(recipes as Recipe[]).map((r, i) => (
                            <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                              <span className="text-xs font-bold">{r.name_bs}</span>
                              <span className="text-[10px] text-slate-500">{r.nutrition.calories} kcal</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Premium Workout Plan */}
                {profile.subscription === 'premium' && (
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2">
                        <Dumbbell className="w-3 h-3" /> Plan Vježbi (Premium)
                      </h4>
                      <span className="bg-cyan-500/20 text-cyan-400 text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest border border-cyan-500/30">
                        Aktivno
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { day: 'Ponedjeljak', focus: 'Gornji dio tijela', exercises: 'Sklekovi, Zgibovi, Ramena' },
                        { day: 'Srijeda', focus: 'Donji dio tijela', exercises: 'Čučnjevi, Iskoraci, Listovi' },
                        { day: 'Petak', focus: 'Full Body & Cardio', exercises: 'Burpees, Plank, Trčanje' }
                      ].map((workout, i) => (
                        <div key={i} className="glass p-5 rounded-3xl border-cyan-500/10 bg-cyan-500/5">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">{workout.day}</span>
                            <span className="text-[10px] text-slate-500">{workout.focus}</span>
                          </div>
                          <p className="text-sm font-bold text-white mb-1">{workout.exercises}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <button className="text-[10px] font-bold text-cyan-400 hover:underline">DETALJI VJEŽBI →</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {activeTab === 'grocery' && (
            <motion.section 
              key="grocery"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Budget Tracker */}
              <div className="glass p-6 rounded-3xl border-cyan-500/20 bg-cyan-500/5">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-cyan-400" />
                  Budžet za hranu
                </h3>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input 
                    type="text" 
                    value={budgetName}
                    onChange={(e) => setBudgetName(e.target.value)}
                    placeholder="Npr. Sedmična kupovina" 
                    className="input-field flex-1 p-3 rounded-xl text-xs min-w-0"
                  />
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                      placeholder="KM" 
                      className="input-field w-24 p-3 rounded-xl text-xs"
                    />
                    <button 
                      onClick={addBudget}
                      className="bg-cyan-500 text-slate-900 p-3 rounded-xl hover:bg-cyan-400 transition-colors shrink-0"
                    >
                      <PlusCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">Ukupno potrošeno:</span>
                  <span className="text-lg font-black text-cyan-400">
                    {budget.reduce((sum, item) => sum + item.amount, 0).toFixed(2)} KM
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2">Dostava (BiH)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => window.open('https://glovoapp.com/ba/bs/sarajevo/hrana_1/', '_blank')}
                    className="glass p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-yellow-500/10 border-yellow-500/20"
                  >
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-xs font-black text-black">G</div>
                    <div className="text-center">
                      <span className="text-[10px] font-bold block">Glovo</span>
                      <span className="text-[8px] text-slate-400 uppercase">Naruči hranu</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => window.open('https://korpa.ba/market', '_blank')}
                    className="glass p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-orange-500/10 border-orange-500/20"
                  >
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-xs font-black text-white">K</div>
                    <div className="text-center">
                      <span className="text-[10px] font-bold block">Korpa Market</span>
                      <span className="text-[8px] text-slate-400 uppercase">Kupi namirnice</span>
                    </div>
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold px-2 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-emerald-500" />
                Shopping lista
              </h3>
              <div className="space-y-2">
                {grocery.length === 0 ? (
                  <p className="text-center text-slate-500 py-10 italic">Ništa za kupiti.</p>
                ) : (
                  grocery.map((item) => (
                    <motion.div 
                      layout
                      key={item.id}
                      className="glass p-4 rounded-2xl flex justify-between items-center border-l-4 border-green-500"
                    >
                      <div>
                        <div className="font-bold text-sm">{item.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{item.fromRecipe || 'Ručni unos'}</div>
                      </div>
                      <button 
                        onClick={() => removeGrocery(item.id)}
                        className="bg-green-500 text-slate-900 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> KUPLJENO
                      </button>
                    </motion.div>
                  ))
                )}
              </div>

              {/* Budget History */}
              {budget.length > 0 && (
                <div className="space-y-3 mt-8">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
                    <History className="w-3 h-3" /> Istorija troškova
                  </h4>
                  {budget.map((item) => (
                    <div key={item.id} className="glass p-4 rounded-2xl flex justify-between items-center bg-slate-800/30">
                      <div>
                        <div className="text-sm font-bold">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{item.date}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-cyan-400">{item.amount.toFixed(2)} KM</span>
                        <button onClick={() => removeBudget(item.id)} className="text-red-500/50 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {activeTab === 'profile' && (
            <motion.section 
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col items-center py-6">
                <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center text-4xl font-black text-slate-900 shadow-xl shadow-emerald-500/20 mb-4">
                  {user ? (user.firstName ? user.firstName[0] : user.email[0]).toUpperCase() : '?'}
                </div>
                <h3 className="text-xl font-bold">{user ? (user.firstName ? `${user.firstName} ${user.lastName}` : user.email) : 'Gost'}</h3>
                <p className="text-xs text-slate-400">{user ? user.email : 'Prijavi se za čuvanje podataka'}</p>
                {user && (
                  <div className="mt-2 text-[10px] text-slate-500 flex flex-col items-center">
                    <span>{user.address}</span>
                    <span>{user.phone}</span>
                  </div>
                )}
                {!user && (
                  <button 
                    onClick={() => { setAuthMode('login'); setShowAuth(true); }}
                    className="mt-4 text-emerald-400 font-bold text-sm border border-emerald-400/30 px-6 py-2 rounded-full hover:bg-emerald-400/10 transition-colors"
                  >
                    PRIJAVI SE
                  </button>
                )}
              </div>

              <div className="glass p-6 rounded-3xl space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Ime</label>
                    <input 
                      type="text" 
                      value={profile.firstName || ''}
                      onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                      className="input-field w-full p-3 rounded-xl mt-1"
                      placeholder="Ime"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Prezime</label>
                    <input 
                      type="text" 
                      value={profile.lastName || ''}
                      onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                      className="input-field w-full p-3 rounded-xl mt-1"
                      placeholder="Prezime"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Adresa stanovanja</label>
                  <input 
                    type="text" 
                    value={profile.address || ''}
                    onChange={(e) => setProfile({...profile, address: e.target.value})}
                    className="input-field w-full p-3 rounded-xl mt-1"
                    placeholder="Ulica i broj, Grad"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Broj telefona</label>
                  <input 
                    type="tel" 
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    className="input-field w-full p-3 rounded-xl mt-1"
                    placeholder="+387 6X XXX XXX"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Visina (cm)</label>
                    <input 
                      type="number" 
                      value={isNaN(profile.height) ? '' : profile.height}
                      onChange={(e) => setProfile({...profile, height: parseInt(e.target.value) || 0})}
                      className="input-field w-full p-3 rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Težina (kg)</label>
                    <input 
                      type="number" 
                      value={isNaN(profile.weight) ? '' : profile.weight}
                      onChange={(e) => setProfile({...profile, weight: parseInt(e.target.value) || 0})}
                      className="input-field w-full p-3 rounded-xl mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nivo aktivnosti</label>
                  <select 
                    value={profile.activity}
                    onChange={(e) => setProfile({...profile, activity: e.target.value as any})}
                    className="input-field w-full p-3 rounded-xl mt-1"
                  >
                    <option value="sedentary">Sjedilački (malo vježbe)</option>
                    <option value="moderate">Umjeren (3-5 dana vježbe)</option>
                    <option value="active">Aktivan (svaki dan vježba)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tvoj cilj</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {['lose', 'maintain', 'gain'].map((g) => (
                      <button
                        key={g}
                        onClick={() => setProfile({...profile, goal: g as any})}
                        className={`p-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                          profile.goal === g 
                            ? 'bg-emerald-500 border-emerald-500 text-slate-900' 
                            : 'bg-slate-800 border-slate-700 text-slate-400'
                        }`}
                      >
                        {g === 'lose' ? 'Smršaj' : g === 'maintain' ? 'Održi' : 'Dobij'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Subscription Plans */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
                  <Star className="w-3 h-3 text-amber-400" /> Subscription Planovi
                </h4>
                
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'basic', name: 'Basic', price: '0 KM', features: ['50 AI Kvote', 'Standardni recepti', 'BMI kalkulator'], icon: ShieldCheck, color: 'text-slate-400' },
                    { id: 'plus', name: 'Plus', price: '9.99 KM', features: ['100 AI Kvote', 'Napredni recepti', 'Water & Step tracking', 'Bez reklama'], icon: Star, color: 'text-emerald-400' },
                    { id: 'premium', name: 'Premium', price: '19.99 KM', features: ['200 AI Kvote', 'Personalizovani planovi', 'AI skener proizvoda', 'Prioritetna podrška'], icon: Crown, color: 'text-amber-400' }
                  ].map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => handleSubscription(plan.id)}
                      className={`glass p-5 rounded-3xl text-left border transition-all ${
                        profile.subscription === plan.id 
                          ? 'border-emerald-500 bg-emerald-500/10' 
                          : 'border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center ${plan.color}`}>
                            <plan.icon className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-black text-sm">{plan.name}</div>
                            <div className="text-[10px] text-slate-500">{plan.price} / mjesečno</div>
                          </div>
                        </div>
                        {profile.subscription === plan.id && (
                          <div className="bg-emerald-500 text-slate-900 text-[8px] font-black px-2 py-1 rounded-full uppercase">Aktivan</div>
                        )}
                      </div>
                      <ul className="space-y-1.5">
                        {plan.features.map((f, i) => (
                          <li key={i} className="text-[10px] text-slate-400 flex items-center gap-2">
                            <div className="w-1 h-1 bg-emerald-500 rounded-full" /> {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </div>

              {/* Legal & Support */}
              <div className="space-y-6 pt-6 border-t border-white/5">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
                    <Scale className="w-3 h-3 text-emerald-400" /> Legalne informacije (BiH)
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'terms', name: 'Uslovi korištenja', icon: FileText },
                      { id: 'privacy', name: 'Politika privatnosti', icon: Shield },
                      { id: 'security', name: 'Sigurnost podataka', icon: Lock },
                      { id: 'confidentiality', name: 'Povjerljivost', icon: ShieldCheck }
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setLegalType(item.id as any);
                          setShowLegalModal(true);
                        }}
                        className="glass p-4 rounded-2xl flex items-center justify-between hover:bg-white/5 border-white/5 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4 text-slate-400" />
                          <span className="text-xs font-bold">{item.name}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                  <h5 className="text-[10px] font-black text-blue-400 uppercase mb-1 flex items-center gap-2">
                    <Smartphone className="w-3 h-3" /> Instalacija na mobitel
                  </h5>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Culina AI je PWA aplikacija. Da bi je koristili kao pravu aplikaciju, kliknite na <span className="text-white font-bold">"Add to Home Screen"</span> u vašem pretraživaču (Safari Share ili Chrome Menu).
                  </p>
                </div>

                <div className="text-center py-2">
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest">Culina AI v1.0.0 • Sarajevo, BiH</p>
                </div>
              </div>

              {user && (
                <div className="glass p-6 rounded-3xl border-red-500/20">
                  <button 
                    onClick={handleLogout}
                    className="w-full text-red-500 font-bold text-sm flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" /> ODJAVI SE
                  </button>
                </div>
              )}

              {/* Footer with Legal Links */}
              <footer className="mt-12 pt-8 border-t border-white/5 pb-8">
                <div className="flex flex-wrap justify-center gap-4 mb-4">
                  <button onClick={() => setShowLegalModal('terms')} className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors">Uslovi korištenja</button>
                  <button onClick={() => setShowLegalModal('privacy')} className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors">Privatnost</button>
                  <button onClick={() => setShowLegalModal('security')} className="text-[10px] text-slate-500 hover:text-emerald-400 transition-colors">Sigurnost</button>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest">© 2024 Culina AI • Sarajevo, BiH</p>
                  <p className="text-[8px] text-slate-700 mt-1">Svi podaci su zaštićeni u skladu sa zakonima BiH</p>
                </div>
              </footer>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 glass border-t border-slate-700 flex justify-around p-4 z-40 max-w-2xl mx-auto">
        <button 
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-wider">Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('fridge')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'fridge' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <Utensils className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-wider">Frižider</span>
        </button>
        <button 
          onClick={() => setActiveTab('meals')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'meals' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <ChefHat className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-wider">Recepti</span>
        </button>
        <button 
          onClick={() => setActiveTab('grocery')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'grocery' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-wider">Kupovina</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'profile' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <User className="w-5 h-5" />
          <span className="text-[8px] font-bold uppercase tracking-wider">Profil</span>
        </button>
      </nav>

      {/* Legal Modal */}
      <AnimatePresence>
        {showLegalModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass w-full max-w-2xl max-h-[80vh] rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                <div className="flex items-center gap-3">
                  <Scale className="w-6 h-6 text-emerald-400" />
                  <h3 className="text-xl font-black text-white">
                    {LEGAL_CONTENT[showLegalModal as keyof typeof LEGAL_CONTENT]?.title || 'Pravne informacije'}
                  </h3>
                </div>
                <button 
                  onClick={() => setShowLegalModal(null)} 
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-8 overflow-y-auto flex-1 no-scrollbar bg-slate-900/20">
                <div className="prose prose-invert max-w-none">
                  {LEGAL_CONTENT[showLegalModal as keyof typeof LEGAL_CONTENT]?.content.split('\n').map((line, i) => (
                    <p key={i} className="text-slate-300 text-sm leading-relaxed mb-4">
                      {line.trim()}
                    </p>
                  ))}
                </div>
                <div className="mt-8 pt-6 border-t border-slate-800">
                  <p className="text-[10px] text-slate-500 text-center italic">
                    Zadnja izmjena: 4. Mart 2026. | Culina AI d.o.o. Sarajevo, BiH
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal for BiH */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass w-full max-w-md p-8 rounded-[2.5rem] space-y-6 border-white/10"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-white">Plaćanje (BiH)</h3>
                <button onClick={() => { setShowPaymentModal(null); setPaymentStep('options'); }} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Aktivacija <span className="text-emerald-400 font-bold uppercase">{showPaymentModal.plan}</span> plana. Odaberite način plaćanja.
                </p>
              </div>

              {paymentStep === 'options' ? (
                <div className="space-y-4">
                  <div className="glass p-4 rounded-2xl border-white/5">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Opcija 1: Kartično plaćanje (Monri / Payteen)</h4>
                    <button 
                      onClick={() => setPaymentStep('card')}
                      className="w-full py-3 bg-slate-800 rounded-xl font-bold text-xs hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" /> UNESI PODATKE KARTICE
                    </button>
                  </div>

                  <div className="glass p-4 rounded-2xl border-white/5">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2">Opcija 2: Direktna uplata (Wise / Banka)</h4>
                    <div className="text-[10px] text-slate-400 space-y-1 mb-3">
                      <p>Primalac: <span className="text-white">Adis Pupalović</span></p>
                      <p>IBAN: <span className="text-white font-mono">BE44 9678 9507 5445</span></p>
                      <p>SWIFT/BIC: <span className="text-white font-mono">TRWIBEB1XXX</span></p>
                      <p>Banka: <span className="text-white">Wise, Rue du Trone 100, Brussels, Belgium</span></p>
                      <p>Svrha: <span className="text-emerald-400 font-bold">Aktivacija {showPaymentModal.plan} plana</span></p>
                    </div>
                    <button 
                      onClick={() => {
                        setProfile(prev => ({ ...prev, subscription: showPaymentModal.plan as any }));
                        setShowPaymentModal(null);
                        setPaymentStep('options');
                        alert("Hvala! Vaš plan će biti aktiviran nakon potvrde uplate.");
                      }}
                      className="w-full py-3 bg-emerald-500 text-slate-900 rounded-xl font-bold text-xs hover:bg-emerald-400 transition-colors"
                    >
                      POTVRDI UPLATU
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <button onClick={() => setPaymentStep('options')} className="text-[10px] text-slate-500 hover:text-white flex items-center gap-1">
                    ← Nazad na opcije
                  </button>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Broj kartice</label>
                      <input 
                        type="text" 
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, '').replace(/(\d{4})/g, '$1 ').trim())}
                        maxLength={19}
                        className="input-field w-full p-4 rounded-2xl mt-1 font-mono"
                        placeholder="0000 0000 0000 0000"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Ističe (MM/YY)</label>
                        <input 
                          type="text" 
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          maxLength={5}
                          className="input-field w-full p-4 rounded-2xl mt-1"
                          placeholder="MM/YY"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">CVC</label>
                        <input 
                          type="password" 
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          maxLength={3}
                          className="input-field w-full p-4 rounded-2xl mt-1"
                          placeholder="***"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        if (cardNumber.length < 16) {
                          alert("Molimo unesite ispravan broj kartice.");
                          return;
                        }
                        setProfile(prev => ({ ...prev, subscription: showPaymentModal.plan as any }));
                        setShowPaymentModal(null);
                        setPaymentStep('options');
                        alert("Uspješno! Vaš plan je aktiviran.");
                      }}
                      className="w-full py-4 bg-emerald-500 text-slate-900 rounded-2xl font-black text-lg mt-4 hover:bg-emerald-400 transition-colors shadow-xl shadow-emerald-500/20"
                    >
                      PLATI {showPaymentModal.plan === 'plus' ? '9.99' : '19.99'} KM
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AnimatePresence>
        {showAuth && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass w-full max-w-md p-8 rounded-3xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black text-white">
                  {authMode === 'login' ? 'Prijava' : 'Registracija'}
                </h3>
                <button onClick={() => setShowAuth(false)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                  {authMode === 'register' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Ime</label>
                          <input 
                            type="text" 
                            required
                            value={authFirstName}
                            onChange={(e) => setAuthFirstName(e.target.value)}
                            className="input-field w-full p-4 rounded-2xl mt-1"
                            placeholder="Ime"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Prezime</label>
                          <input 
                            type="text" 
                            required
                            value={authLastName}
                            onChange={(e) => setAuthLastName(e.target.value)}
                            className="input-field w-full p-4 rounded-2xl mt-1"
                            placeholder="Prezime"
                          />
                        </div>
                      </div>
                      <div className="relative">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Adresa</label>
                        <input 
                          type="text" 
                          required
                          value={authAddress}
                          onChange={(e) => setAuthAddress(e.target.value)}
                          className="input-field w-full p-4 rounded-2xl mt-1"
                          placeholder="Ulica i broj, Grad"
                        />
                        <AnimatePresence>
                          {showAddressSuggestions && addressSuggestions.length > 0 && (
                            <motion.div 
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute left-0 right-0 top-full mt-2 glass rounded-2xl overflow-hidden z-50 shadow-2xl border border-white/10"
                            >
                              {addressSuggestions.map((s, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => {
                                    setAuthAddress(s);
                                    setShowAddressSuggestions(false);
                                  }}
                                  className="w-full p-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-sm"
                                >
                                  {s}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Poštanski broj</label>
                        <input 
                          type="text" 
                          required
                          value={authPostcode}
                          onChange={(e) => setAuthPostcode(e.target.value)}
                          className="input-field w-full p-4 rounded-2xl mt-1"
                          placeholder="71000"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Telefon</label>
                        <input 
                          type="tel" 
                          required
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          className="input-field w-full p-4 rounded-2xl mt-1 flex items-center"
                          placeholder="+387 6X XXX XXX"
                          style={{ lineHeight: 'normal' }}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email</label>
                    <input 
                      type="email" 
                      required
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      className="input-field w-full p-4 rounded-2xl mt-1"
                      placeholder="tvoj@email.com"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Lozinka</label>
                    <input 
                      type="password" 
                      required
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      className="input-field w-full p-4 rounded-2xl mt-1"
                      placeholder="••••••••"
                    />
                  </div>
                  
                  {authMode === 'register' && (
                    <div className="flex items-start gap-3 p-2">
                      <input type="checkbox" required className="mt-1 accent-emerald-500" />
                      <p className="text-[10px] text-slate-400 leading-tight">
                        Registracijom prihvatam <button type="button" onClick={() => setShowLegalModal('terms')} className="text-emerald-400 underline">Uslove korištenja</button> i <button type="button" onClick={() => setShowLegalModal('privacy')} className="text-emerald-400 underline">Politiku privatnosti</button> u skladu sa zakonima BiH.
                      </p>
                    </div>
                  )}
                </div>
                <button type="submit" className="btn-primary w-full py-4 rounded-2xl font-bold text-lg">
                  {authMode === 'login' ? 'PRIJAVI SE' : 'REGISTRUJ SE'}
                </button>
              </form>

              <div className="text-center">
                <button 
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-xs text-emerald-400 font-bold uppercase tracking-widest"
                >
                  {authMode === 'login' ? 'Nemaš nalog? Registruj se' : 'Imaš nalog? Prijavi se'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Meal Plan Selector Modal */}
      <AnimatePresence>
        {showMealPlanSelector && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass w-full max-w-sm p-8 rounded-3xl space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-white">Dodaj u plan</h3>
                <button onClick={() => setShowMealPlanSelector(null)} className="p-2 hover:bg-white/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota', 'Nedjelja'].map(day => (
                  <button
                    key={day}
                    onClick={() => {
                      addToMealPlan(day, showMealPlanSelector.recipe);
                      setShowMealPlanSelector(null);
                    }}
                    className="w-full p-4 glass rounded-2xl text-left hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all font-bold text-sm"
                  >
                    {day}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recipe Popup */}
      <AnimatePresence>
        {selectedRecipe && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-4">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="glass w-full max-w-2xl h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-lg text-amber-400">{selectedRecipe.name_bs}</h3>
                <button 
                  onClick={() => setSelectedRecipe(null)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 no-scrollbar text-slate-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6 text-center">
                  <div className="bg-slate-800 p-2 rounded-xl text-[10px]">
                    <div className="text-amber-400 font-bold">{selectedRecipe.nutrition?.calories || '?'}</div>
                    Kcal
                  </div>
                  <div className="bg-slate-800 p-2 rounded-xl text-[10px]">
                    <div className="text-amber-400 font-bold">{selectedRecipe.nutrition?.protein || '?'}g</div>
                    Prot
                  </div>
                  <div className="bg-slate-800 p-2 rounded-xl text-[10px]">
                    <div className="text-amber-400 font-bold">{selectedRecipe.nutrition?.carbs || '?'}g</div>
                    UH
                  </div>
                  <div className="bg-slate-800 p-2 rounded-xl text-[10px]">
                    <div className="text-amber-400 font-bold">{selectedRecipe.nutrition?.fat || '?'}g</div>
                    Masti
                  </div>
                </div>

                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-amber-500" /> Sastojci:
                </h4>
                <ul className="mb-6 space-y-2">
                  {selectedRecipe.ingredients.map((ing, i) => (
                    <li key={i} className="text-sm bg-white/5 p-3 rounded-xl border-l-2 border-amber-500 break-words">
                      {ing}
                    </li>
                  ))}
                </ul>

                <h4 className="font-bold mb-3 flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-amber-500" /> Priprema:
                </h4>
                <div className="space-y-4 text-sm leading-relaxed">
                  {selectedRecipe.instructions_bs.map((step, i) => (
                    <div key={i} className="flex gap-3">
                      <span className="text-amber-500 font-bold min-w-[20px]">{i + 1}.</span>
                      <p>{step}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-8">
                  <button 
                    onClick={() => cookRecipe(selectedRecipe)}
                    className="btn-primary py-4 rounded-2xl flex items-center justify-center gap-2 text-xs bg-orange-500 hover:bg-orange-600"
                  >
                    <ChefHat className="w-4 h-4" />
                    PRIPREMI JELO
                  </button>
                  <button 
                    onClick={() => addMissingToGrocery(selectedRecipe)}
                    className="glass py-4 rounded-2xl flex items-center justify-center gap-2 text-xs border-white/10"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    U KORPU
                  </button>
                </div>
                <div className="grid grid-cols-1 mt-3">
                  <button 
                    onClick={() => setShowMealPlanSelector({ recipe: selectedRecipe })}
                    className="glass py-4 rounded-2xl flex items-center justify-center gap-2 text-xs border-emerald-500/30 text-emerald-400"
                  >
                    <ChefHat className="w-4 h-4" />
                    DODAJ U SEDMIČNI PLANER
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Browser Modal */}
      <AnimatePresence>
        {showCategoryBrowser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass w-full max-w-lg max-h-[80vh] rounded-3xl overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-lg text-emerald-400">Kategorije namirnica</h3>
                <button 
                  onClick={() => setShowCategoryBrowser(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 no-scrollbar space-y-2">
                {INGREDIENT_CATEGORIES.map((cat) => (
                  <div key={cat.name} className="border border-white/5 rounded-2xl overflow-hidden">
                    <button 
                      onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                      className="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-colors"
                    >
                      <span className="font-bold text-sm">{cat.name}</span>
                      {expandedCategory === cat.name ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <AnimatePresence>
                      {expandedCategory === cat.name && (
                        <motion.div 
                          initial={{ height: 0 }}
                          animate={{ height: 'auto' }}
                          exit={{ height: 0 }}
                          className="overflow-hidden bg-white/5"
                        >
                          <div className="p-4 grid grid-cols-2 gap-2">
                            {cat.items.map((item) => (
                              <button
                                key={item}
                                onClick={() => {
                                  setIngName(item);
                                  setShowCategoryBrowser(false);
                                }}
                                className="text-left p-2 text-xs hover:text-emerald-400 transition-colors"
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
