import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Alert } from '../ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Eye, EyeOff, HelpCircle, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SignupFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const getPasswordStrength = (password: string): number => {
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;
    
    // Character variety checks
    if (/[a-z]/.test(password)) strength += 20;
    if (/[A-Z]/.test(password)) strength += 20;
    if (/\d/.test(password)) strength += 20;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 20;
    
    // Bonus for longer passwords
    if (password.length >= 16) strength += 10;
    
    return Math.min(strength, 100);
  };

  const validateField = (name: string, value: string, confirmValue?: string): string | null => {
    switch (name) {
      case 'email':
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email address';
        return null;
      case 'full_name':
        if (!value.trim()) return 'Full name is required';
        if (value.trim().length < 2) return 'Full name must be at least 2 characters';
        if (value.trim().length > 50) return 'Full name must be less than 50 characters';
        const nameRegex = /^[a-zA-Z\s'-]+$/;
        if (!nameRegex.test(value.trim())) return 'Full name can only contain letters, spaces, hyphens, and apostrophes';
        return null;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (value.length > 128) return 'Password must be less than 128 characters';
        if (!/(?=.*[a-z])/.test(value)) return 'Password must contain at least one lowercase letter';
        if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain at least one uppercase letter';
        if (!/(?=.*\d)/.test(value)) return 'Password must contain at least one number';
        if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(value)) return 'Password must contain at least one special character';
        return null;
      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (confirmValue && value !== confirmValue) return 'Passwords do not match';
        return null;
      default:
        return null;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Validate field on change
    let fieldError = null;
    if (name === 'confirmPassword') {
      fieldError = validateField(name, value, formData.password);
    } else {
      fieldError = validateField(name, value);
      // Also revalidate confirm password if password changes
      if (name === 'password' && formData.confirmPassword) {
        const confirmError = validateField('confirmPassword', formData.confirmPassword, value);
        setValidationErrors(prev => ({
          ...prev,
          confirmPassword: confirmError || ''
        }));
      }
    }
    
    setValidationErrors(prev => ({
      ...prev,
      [name]: fieldError || ''
    }));
    
    // Clear global error when user starts typing
    if (error) setError(null);
  };

  const validateForm = (): boolean => {
    const errors: {[key: string]: string} = {};
    
    // Validate all fields
    const emailError = validateField('email', formData.email);
    if (emailError) errors.email = emailError;
    
    const nameError = validateField('full_name', formData.full_name);
    if (nameError) errors.full_name = nameError;
    
    const passwordError = validateField('password', formData.password);
    if (passwordError) errors.password = passwordError;
    
    const confirmPasswordError = validateField('confirmPassword', formData.confirmPassword, formData.password);
    if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await signup({
        email: formData.email.trim(),
        password: formData.password,
        full_name: formData.full_name.trim(),
      });
      onSuccess?.();
    } catch (err: any) {
      console.error('Signup error:', err);
      
      // Extract error message from API response
      let errorMessage = 'Account creation failed. Please try again.';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = formData.email.trim() && 
                  formData.password && 
                  formData.confirmPassword && 
                  formData.full_name.trim() &&
                  Object.values(validationErrors).every(error => !error);

  const passwordsMatch = formData.password === formData.confirmPassword;

  return (
    <Card className="w-full max-w-md mx-auto p-6">
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">Create your account</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Get started with Clarticle today
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
              disabled={isLoading}
              className={`w-full ${validationErrors.email ? 'border-red-500' : ''}`}
            />
            {validationErrors.email && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="full_name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Full Name
            </label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              value={formData.full_name}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
              disabled={isLoading}
              className={`w-full ${validationErrors.full_name ? 'border-red-500' : ''}`}
            />
            {validationErrors.full_name && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.full_name}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleChange}
                placeholder="Create a strong password"
                required
                disabled={isLoading}
                className={`w-full pr-10 ${validationErrors.password ? 'border-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto font-normal"
                    disabled={isLoading}
                  >
                    <HelpCircle className="h-3 w-3 mr-1" />
                    Password requirements
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top" align="start">
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">Password Requirements</div>
                    <div className="text-xs text-muted-foreground">
                      Your password must meet all of the following:
                    </div>
                    <div className="space-y-2">
                      <div className={`flex items-center gap-2 text-xs ${
                        formData.password.length >= 8 ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {formData.password.length >= 8 ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        At least 8 characters
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${
                        /[A-Z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {/[A-Z]/.test(formData.password) ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        One uppercase letter (A-Z)
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${
                        /[a-z]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {/[a-z]/.test(formData.password) ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        One lowercase letter (a-z)
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${
                        /\d/.test(formData.password) ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {/\d/.test(formData.password) ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        One number (0-9)
                      </div>
                      <div className={`flex items-center gap-2 text-xs ${
                        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password) ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        One special character (!@#$%^&*)
                      </div>
                    </div>
                    {formData.password && (
                      <div className="mt-3">
                        <div className="text-xs font-medium mb-2">Password Strength:</div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              getPasswordStrength(formData.password) >= 80 ? 'bg-green-500' :
                              getPasswordStrength(formData.password) >= 60 ? 'bg-yellow-500' :
                              getPasswordStrength(formData.password) >= 40 ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${getPasswordStrength(formData.password)}%` }}
                          />
                        </div>
                        <div className="text-xs mt-1 text-muted-foreground">
                          {getPasswordStrength(formData.password) >= 80 ? 'Very Strong' :
                           getPasswordStrength(formData.password) >= 60 ? 'Strong' :
                           getPasswordStrength(formData.password) >= 40 ? 'Medium' :
                           'Weak'}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            {validationErrors.password && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                required
                disabled={isLoading}
                className={`w-full pr-10 ${validationErrors.confirmPassword ? 'border-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                disabled={isLoading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {validationErrors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{validationErrors.confirmPassword}</p>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <div className="text-sm">{error}</div>
            </Alert>
          )}

          <motion.div
            whileHover={{ scale: !isLoading ? 1.02 : 1 }}
            whileTap={{ scale: !isLoading ? 0.98 : 1 }}
            className="w-full"
          >
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 border-0 shadow-lg transition-all duration-300 relative overflow-hidden group" 
              disabled={!isValid || !passwordsMatch || isLoading}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                initial={{ x: "-100%" }}
                animate={!isLoading ? { x: "200%" } : {}}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
              />
              <span className="relative z-10">
                {isLoading ? (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    Creating account...
                  </motion.span>
                ) : (
                  'Create account'
                )}
              </span>
            </Button>
          </motion.div>
        </form>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="font-medium text-primary hover:underline"
              disabled={isLoading}
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </Card>
  );
};