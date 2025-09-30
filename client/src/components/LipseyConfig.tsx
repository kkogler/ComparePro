import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

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
  const { toast } = useToast();

  // Load existing credentials when modal opens
  useEffect(() => {
    if (open && vendorId && vendorId > 0) {
      loadExistingCredentials();
    }
  }, [open, vendorId]);

  const loadExistingCredentials = async () => {
    try {
      const response = await fetch(`/org/${organizationSlug}/api/vendors`, {
        method: 'GET',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vendors: ${response.status}`);
      }
      
      const vendors = await response.json();
      const vendor = vendors.find((v: any) => v.id === vendorId);
      
      if (vendor && vendor.credentials) {
        setEmail(vendor.credentials.email || '');
        setPassword(vendor.credentials.password || '');
      }
    } catch (error) {
      console.error('Failed to load existing credentials:', error);
    }
  };

  const handleTestConnection = async () => {
    if (!email || !password) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both email and password before testing.",
        variant: "destructive",
      });
      return;
    }

    if (!vendorId || vendorId <= 0) {
      toast({
        title: "Invalid Vendor",
        description: "Vendor configuration error. Please reload the page.",
        variant: "destructive",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      console.log('🔍 LIPSEY TEST: Starting connection test');
      console.log('🔍 LIPSEY TEST: Using vendor ID:', vendorId);
      
      // ✅ FIX: Remove redundant save - test connection should use already saved credentials
      // The credentials should already be saved when the user clicked "Save"
      const vendorIdentifier = vendor?.slug || vendor?.vendorShortCode || vendorId;
      const response = await fetch(`/org/${organizationSlug}/api/vendors/${vendorIdentifier}/test-connection`, {
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
    if (!email || !password) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    if (!vendorId || vendorId <= 0) {
      toast({
        title: "Invalid Vendor",
        description: "Vendor configuration error. Please reload the page.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiRequest(
        `/org/${organizationSlug}/api/vendors/${vendor?.slug || vendor?.vendorShortCode || vendorId}/credentials`,
        'POST',
        {
          email: email.trim(),
          password: password.trim()
        }
      );

      if (response.ok) {
        toast({
          title: "Credentials Saved",
          description: "Lipsey's API credentials have been saved successfully.",
        });
        
        onSuccess?.();
        onOpenChange(false);
      } else {
        const error = await response.json();
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
    setEmail('');
    setPassword('');
    setTestResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Lipsey's API Configuration
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
              variant="outline"
              size="sm"
              onClick={() => window.open('https://forms.office.com/Pages/ResponsePage.aspx?id=X654_c0rsk2wjv95IGAUMcxFCPJ9ZUFCqCosllGjJbtUOUFMSDhVVE1FSEYzV0w1WUY5S1BITFJWQSQlQCN0PWcu', '_blank')}
              className="text-blue-700 dark:text-blue-300"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Submit Approval Form
            </Button>
          </div>

          {/* Credentials Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="dealer@yourstore.com"
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
                placeholder="Your Lipsey's password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Test Connection Result */}
          {testResult && (
            <div className={`rounded-lg border p-4 ${
              testResult.success 
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                <span className={`font-medium ${
                  testResult.success 
                    ? 'text-green-900 dark:text-green-100' 
                    : 'text-red-900 dark:text-red-100'
                }`}>
                  {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                </span>
              </div>
              <p className={`text-sm ${
                testResult.success 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-red-700 dark:text-red-300'
              }`}>
                {testResult.message}
              </p>
              {testResult.dealerInfo && (
                <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                  <p><strong>Dealer:</strong> {testResult.dealerInfo.name}</p>
                  <p><strong>Customer #:</strong> {testResult.dealerInfo.cusNo}</p>
                  <p><strong>Location:</strong> {testResult.dealerInfo.locationName}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-between">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || !email || !password}
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
                disabled={isLoading || !email || !password}
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

          {/* API Documentation Link */}
          <div className="text-center pt-4 border-t">
            <Button
              variant="link"
              size="sm"
              onClick={() => window.open('https://api.lipseys.com/', '_blank')}
              className="text-muted-foreground"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              View Lipsey's API Documentation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}