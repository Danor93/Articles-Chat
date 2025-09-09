import React, { useState } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export const AuthDialog: React.FC<AuthDialogProps> = ({ 
  isOpen, 
  onClose, 
  initialMode = 'login' 
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);

  const handleSuccess = () => {
    onClose();
  };

  const handleSwitchToSignup = () => {
    setMode('signup');
  };

  const handleSwitchToLogin = () => {
    setMode('login');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        {mode === 'login' ? (
          <LoginForm 
            onSuccess={handleSuccess} 
            onSwitchToSignup={handleSwitchToSignup} 
          />
        ) : (
          <SignupForm 
            onSuccess={handleSuccess} 
            onSwitchToLogin={handleSwitchToLogin} 
          />
        )}
      </DialogContent>
    </Dialog>
  );
};