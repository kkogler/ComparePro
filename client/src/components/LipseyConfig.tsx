import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, ExternalLink } from 'lucide-react';
import { buildVendorApiUrl } from '@/lib/vendor-utils';

interface LipseyConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId?: number; // Legacy support
  vendor?: any; // Preferred: full vendor object with slug
  organizationSlug: string;
  onSuccess?: () => void;
}

export function LipseyConfig({ 
  open, 
  onOpenChange, 
  vendorId, 
  vendor,
  organizationSlug,
  onSuccess 
}: LipseyConfigProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; dealerInfo?: any } | null>(null);
  const [hasExistingCredentials, setHasExistingCredentials] = useState(false);
  const { toast } = useToast();

  // Load existing credentials when modal opens
  useEffect(() => {
    console.log('🔍 LIPSEY MODAL: useEffect triggered', { open, vendorSlug: vendor?.slug, vendorId });
    if (open && (vendor?.slug || vendorId)) {
      // Reset state and load fresh credentials when modal opens
      console.log('🔍 LIPSEY MODAL: Modal is opening, loading credentials...');
      setTestResult(null);
      loadExistingCredentials();
    } else if (!open) {
      // Clear form state when modal closes
      console.log('🔍 LIPSEY MODAL: Modal is closing, clearing state...');
      setEmail('');
      setPassword('');
      setTestResult(null);
      setHasExistingCredentials(false);
    }
  }, [open, vendor?.slug, vendorId]);

  const loadExistingCredentials = async () => {
    try {
      // ✅ STANDARDIZED: Use vendor utility to get correct identifier
      const apiUrl = buildVendorApiUrl(organizationSlug, vendor || { id: vendorId }, 'credentials');
      console.log('🔍 LIPSEY LOAD CREDS API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('🔍 LIPSEY LOAD CREDS: Failed to fetch:', response.status);
        throw new Error(`Failed to fetch credentials: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('🔍 LIPSEY LOAD CREDS: Received data:', { 
        success: data.success, 
        hasCredentials: !!data.credentials,
        email: data.credentials?.email ? 'present' : 'missing',
        password: data.credentials?.password ? data.credentials.password : 'missing'
      });
      
      if (data.success && data.credentials && (data.credentials.email || data.credentials.password)) {
        setEmail(data.credentials.email || '');
        // Check if credentials exist (password is redacted as ••••••••)
        const pwd = data.credentials.password;
        if (pwd && pwd === '••••••••') {
          // Credentials exist but are redacted for security - show the masked value
          console.log('🔍 LIPSEY LOAD CREDS: Found existing credentials (password redacted)');
          setHasExistingCredentials(true);
          setPassword('••••••••'); // Show masked value so user knows password exists
        } else if (pwd) {
          // Actual password returned (shouldn't happen but handle it)
          console.log('🔍 LIPSEY LOAD CREDS: Found credentials with actual password');
          setPassword(pwd);
          setHasExistingCredentials(true);
        } else {
          console.log('🔍 LIPSEY LOAD CREDS: No password found');
          setHasExistingCredentials(false);
          setPassword('');
        }
      } else {
        console.log('🔍 LIPSEY LOAD CREDS: No credentials found in response');
        setHasExistingCredentials(false);
        setPassword('');
      }
    } catch (error) {
      console.error('🔍 LIPSEY LOAD CREDS: Error loading credentials:', error);
      setHasExistingCredentials(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      console.log('🔍 LIPSEY TEST: Starting connection test');
      
      // ✅ STANDARDIZED: Use vendor utility to get correct identifier
      const apiUrl = buildVendorApiUrl(organizationSlug, vendor || { id: vendorId }, 'test-connection');
      console.log('🔍 LIPSEY TEST API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      setTestResult(result);

      if (result.success) {
        toast({
          title: "Connection Successful",
          description: `Connected successfully as ${result.dealerInfo?.name || 'dealer'}`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      const errorResult = {
        success: false,
        message: `Connection failed: ${error.message}`
      };
      setTestResult(errorResult);
      
      toast({
        title: "Test Failed",
        description: errorResult.message,
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    // Check if password is just the placeholder (not changed)
    const isPasswordPlaceholder = password === '••••••••';
    
    // If password is placeholder and we have existing credentials, allow save (preserves existing password)
    // If no existing credentials, require actual password
    if (!email || (!password && !hasExistingCredentials) || (!isPasswordPlaceholder && !password)) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both username and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Build credentials object - only include password if it's been changed (not placeholder)
      const credentials: any = {
        email: email.trim()
      };
      
      // Only send password if it's not the placeholder (meaning user entered a new password)
      if (!isPasswordPlaceholder && password) {
        credentials.password = password.trim();
      }
      
      // ✅ STANDARDIZED: Use vendor utility to get correct identifier
      const apiUrl = buildVendorApiUrl(organizationSlug, vendor || { id: vendorId }, 'credentials');
      console.log('🔍 LIPSEY SAVE API URL:', apiUrl);
      console.log('🔍 LIPSEY SAVE: Sending credentials:', { 
        email: credentials.email, 
        hasPassword: !!credentials.password,
        passwordLength: credentials.password?.length || 0,
        credentialKeys: Object.keys(credentials)
      });
      
      const response = await apiRequest(apiUrl, 'POST', credentials);

      if (response.ok) {
        toast({
          title: "Credentials Saved",
          description: "Lipsey's API credentials have been saved successfully.",
        });
        
        // Mark that credentials now exist
        setHasExistingCredentials(true);
        
        onSuccess?.();
        onOpenChange(false);
      } else {
        const error = await response.json();
        console.error('🔍 LIPSEY SAVE ERROR:', error);
        throw new Error(error.message || 'Failed to save credentials');
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Lipsey's Admin Credentials
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* API Information */}
          <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Required: Domain/IP Pre-approval
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
              Lipsey's requires domain and IP address pre-approval before API access is granted.
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => window.open('https://api.lipseys.com/', '_blank')}
              className="text-blue-700 dark:text-blue-300 p-0 h-auto"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Lipsey's API Documentation
            </Button>
          </div>

          {/* Credentials Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Username</Label>
              <Input
                id="email"
                type="text"
                placeholder="Enter username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-between">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || (!hasExistingCredentials && (!email || !password))}
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={isLoading || !email || (!password && !hasExistingCredentials)}
                className="btn-orange-action"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Credentials'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}