import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../ui/button';
import { Avatar } from '../ui/avatar';
import { Card } from '../ui/card';
import { Dialog, DialogContent } from '../ui/dialog';
import { Input } from '../ui/input';
import { Alert } from '../ui/alert';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../theme-provider';
import { Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UserMenuProps {
  className?: string;
}

export const UserMenu: React.FC<UserMenuProps> = ({ className }) => {
  const { user, logout, updateProfile, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      setShowDropdown(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <>
      <div ref={dropdownRef} className={`relative ${className}`}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 hover:bg-accent hover:text-accent-foreground rounded-md p-2"
        >
          <Avatar className="w-8 h-8">
            <div className="w-full h-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              {getInitials(user.full_name)}
            </div>
          </Avatar>
          <span className="text-sm font-medium hidden md:block">{user.full_name}</span>
        </button>

        {showDropdown && (
            <Card className="absolute right-0 top-full mt-2 w-64 z-50 p-4 space-y-2 shadow-lg border">
              <div className="border-b pb-2 mb-2">
                <p className="font-medium">{user.full_name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowProfileDialog(true);
                  setShowDropdown(false);
                }}
                className="w-full justify-start"
              >
                Edit Profile
              </Button>
              
              <div className="flex items-center justify-between py-2 px-2">
                <div className="flex items-center gap-2">
                  <AnimatePresence mode="wait">
                    {theme === "light" ? (
                      <motion.div
                        key="sun"
                        initial={{ scale: 0, rotate: -90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: 90 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <Sun className="h-4 w-4 text-yellow-500" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="moon"
                        initial={{ scale: 0, rotate: 90 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: -90 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      >
                        <Moon className="h-4 w-4 text-blue-400" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span className="text-sm font-medium">
                    {theme === "light" ? "Light Mode" : "Dark Mode"}
                  </span>
                </div>
                
                <motion.button
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  className={`relative w-12 h-6 rounded-full p-1 transition-colors duration-300 ${
                    theme === "dark" 
                      ? "bg-gradient-to-r from-blue-500 to-purple-600" 
                      : "bg-gradient-to-r from-yellow-400 to-orange-500"
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="w-4 h-4 rounded-full bg-white shadow-lg flex items-center justify-center"
                    animate={{
                      x: theme === "dark" ? 24 : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                    }}
                  >
                    <motion.div
                      animate={{
                        rotate: theme === "dark" ? 180 : 0,
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    >
                      {theme === "dark" ? (
                        <Moon className="h-2.5 w-2.5 text-blue-600" />
                      ) : (
                        <Sun className="h-2.5 w-2.5 text-yellow-600" />
                      )}
                    </motion.div>
                  </motion.div>
                  
                  {/* Glowing effect */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{
                      boxShadow: theme === "dark" 
                        ? "0 0 20px rgba(59, 130, 246, 0.3)" 
                        : "0 0 20px rgba(251, 191, 36, 0.3)",
                    }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.button>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="w-full justify-start text-red-600 hover:text-red-600 hover:bg-red-50"
              >
                Sign Out
              </Button>
            </Card>
        )}
      </div>

      <ProfileDialog
        isOpen={showProfileDialog}
        onClose={() => setShowProfileDialog(false)}
        user={user}
        onUpdate={updateProfile}
      />
    </>
  );
};

interface ProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onUpdate: (data: { full_name: string }) => Promise<void>;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({ isOpen, onClose, user, onUpdate }) => {
  const [fullName, setFullName] = useState(user.full_name);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedName = fullName.trim();
    if (trimmedName.length < 2) {
      setError('Full name must be at least 2 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await onUpdate({ full_name: trimmedName });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Profile update error:', err);
      
      let errorMessage = 'Failed to update profile. Please try again.';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = fullName.trim() !== user.full_name;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <Card className="p-6">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight">Edit Profile</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Update your account information
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium">
                  Full Name
                </label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  disabled={isLoading}
                  required
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <div className="text-sm">{error}</div>
                </Alert>
              )}

              {success && (
                <Alert>
                  <div className="text-sm text-green-600">Profile updated successfully!</div>
                </Alert>
              )}

              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!hasChanges || isLoading}
                  className="flex-1"
                >
                  {isLoading ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </form>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
};