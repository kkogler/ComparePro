import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { hostBasedTenantResolver, canonicalUrlRedirect } from './host-based-tenant-resolver';

declare global {
  namespace Express {
    interface User extends SelectUser {}
    interface Request {
      organizationSlug?: string;
      organizationId?: number;
    }
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored?: string | null): Promise<boolean> {
  // Return false if no stored password
  if (!stored) return false;
  
  try {
    // Check if it's a bcrypt hash (starts with $2b$, $2a$, or $2y$)
    if (stored.startsWith('$2b$') || stored.startsWith('$2a$') || stored.startsWith('$2y$')) {
      return await bcrypt.compare(supplied, stored);
    }
    
    // Otherwise, assume it's scrypt format (hash.salt)
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) {
      return false; // Invalid format, return false instead of throwing
    }
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
}

// Middleware to extract organization from URL or hostname
export function organizationMiddleware(req: any, res: any, next: any) {
  try {
    // Skip organization middleware for static assets, components, and non-org routes
    if (req.url && typeof req.url === 'string') {
      const url = req.url;
      
      // Skip for Vite development assets and components
      if (url.startsWith('/@') || 
          url.startsWith('/src/') || 
          url.startsWith('/node_modules/') ||
          url.includes('.tsx') || 
          url.includes('.ts') ||
          url.includes('.js') ||
          url.includes('.css') ||
          url.includes('.svg') ||
          url.includes('.png') ||
          url.includes('.jpg') ||
          url.includes('.jpeg') ||
          url.includes('.gif') ||
          url.includes('.ico') ||
          url.includes('.woff') ||
          url.includes('.woff2') ||
          url.includes('.ttf') ||
          url.includes('.eot')) {
        return next();
      }
    }

    // console.log(`ORG MIDDLEWARE: Processing URL: ${req.url}`); // Disabled - too verbose
    
    // First, check if organization was already resolved from hostname (host mode)
    if (req.hostBasedSlug && req.resolvedFromHost) {
      // console.log(`ORG MIDDLEWARE: Using host-based resolution: ${req.hostBasedSlug}`); // Disabled - too verbose
      req.organizationSlug = req.hostBasedSlug;
      return next();
    }

    // Path-based resolution (existing logic for /org/{slug}/ routes)
    if (req.url && typeof req.url === 'string') {
      const urlParts = req.url.split('/');
      if (urlParts[1] === 'org' && urlParts[2]) {
        // Extract just the slug part (before any query parameters)
        const slugPart = urlParts[2].split('?')[0];
        req.organizationSlug = slugPart;
        // console.log(`ORG MIDDLEWARE: Using path-based resolution: ${slugPart}`); // Disabled - too verbose
      }
    }
    
    // console.log(`ORG MIDDLEWARE: Final organizationSlug: ${req.organizationSlug}`); // Disabled - too verbose
  } catch (error) {
    console.error('Error in organizationMiddleware:', error);
  }
  next();
}

// Middleware to get organization context
export async function getOrganizationContext(req: any, res: any, next: any) {
  // console.log(`ORG CONTEXT: organizationSlug: ${req.organizationSlug}`); // Disabled - too verbose
  
  if (req.organizationSlug) {
    try {
      const org = await storage.getCompanyBySlug(req.organizationSlug);
      // console.log(`ORG CONTEXT: Found organization:`, org); // Disabled - too verbose
      
      if (org) {
        req.organizationId = org.id;
        // console.log(`ORG CONTEXT: Set organizationId to: ${req.organizationId}`); // Disabled - too verbose
      } else {
        console.log(`ORG CONTEXT: Organization not found for slug: ${req.organizationSlug}`);
        return res.status(404).json({ message: "Organization not found" });
      }
    } catch (error) {
      console.error('ORG CONTEXT ERROR:', error);
      return res.status(500).json({ message: "Failed to get organization context" });
    }
  } else {
    // console.log(`ORG CONTEXT: No organizationSlug found`); // Disabled - too verbose
  }
  next();
}

// Middleware to ensure user belongs to organization
export function requireOrganizationAccess(req: any, res: any, next: any) {
  console.log('AUTH: requireOrganizationAccess called for:', req.url);
  console.log('AUTH: isAuthenticated():', req.isAuthenticated());
  console.log('AUTH: user:', req.user?.username);
  console.log('AUTH: organizationId from URL:', req.organizationId);
  console.log('AUTH: user companyId:', req.user?.companyId);
  console.log('AUTH: admin impersonation:', req.session?.adminImpersonation ? 'active' : 'none');
  
  if (!req.isAuthenticated()) {
    console.log('AUTH: User not authenticated - returning 401');
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Check for admin impersonation
  const isAdminUser = req.user.companyId === null;
  const hasImpersonation = (req.session as any)?.adminImpersonation;
  const belongsToOrganization = req.user.companyId === req.organizationId;
  
  // Allow access if:
  // 1. Admin user with valid impersonation for this organization
  // 2. Admin user without impersonation (general admin access)  
  // 3. Regular user belongs to organization
  const allowedByImpersonation = isAdminUser && hasImpersonation && hasImpersonation.organizationId === req.organizationId;
  const allowedByAdminAccess = isAdminUser;
  const allowedByMembership = belongsToOrganization;
  
  if (req.organizationId && !allowedByImpersonation && !allowedByAdminAccess && !allowedByMembership) {
    console.log('AUTH: Organization access denied - returning 403');
    return res.status(403).json({ message: "Access denied to this organization" });
  }
  
  if (allowedByImpersonation) {
    console.log('AUTH: Admin impersonation access granted');
  } else if (allowedByAdminAccess) {
    console.log('AUTH: Admin user access granted to any organization');
  } else {
    console.log('AUTH: Organization member access granted');
  }
  
  next();
}

// Admin auth middleware
export function requireAdminAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  // Check if user is admin (companyId is null for admin users)
  if (req.user.companyId !== null) {
    return res.status(401).json({ message: "Administrator access required" });
  }
  
  next();
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "dev-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: 'lax', // Allow cookies to be sent when navigating from admin to org pages
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Host-based tenant resolution (Phase 2) - must come first
  app.use(hostBasedTenantResolver);
  app.use(canonicalUrlRedirect);

  // Organization middleware (supports both host and path modes)
  app.use(organizationMiddleware);
  app.use(getOrganizationContext);

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !user.password) {
          return done(null, false);
        }
        if (!(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // User not found, clear the session
        done(null, false);
      } else {
        done(null, user);
      }
    } catch (error) {
      console.error('Passport deserialize error:', error);
      // Clear the session on error
      done(null, false);
    }
  });

  // Organization-specific auth routes
  app.post("/org/:slug/api/register", async (req, res, next) => {
    try {
      const org = await storage.getCompanyBySlug(req.params.slug);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        companyId: org.id,
        password: await hashPassword(req.body.password),
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(user);
      });
    } catch (error) {
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/org/:slug/api/login", async (req, res, next) => {
    try {
      console.log(`ORG LOGIN ATTEMPT: slug=${req.params.slug}, username=${req.body.username}`);
      
      const org = await storage.getCompanyBySlug(req.params.slug);
      if (!org) {
        console.log(`ORG LOGIN: Organization not found for slug: ${req.params.slug}`);
        return res.status(404).json({ message: "Organization not found" });
      }
      console.log(`ORG LOGIN: Found organization: ${org.name} (ID: ${org.id})`);

      // Try to find organization user first, then fallback to admin user
      const orgUser = await storage.getUserByUsernameAndCompany(req.body.username, org.id);
      const user = orgUser || await storage.getAdminUserByUsername(req.body.username);
      console.log(`ORG LOGIN: User lookup result:`, user ? `Found user ${user.username} (companyId: ${user.companyId})` : 'User not found');
      
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!(await comparePasswords(req.body.password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Update last login timestamp
      await storage.updateUserLastLogin(user.id);

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(200).json(user);
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/org/:slug/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/org/:slug/api/user", requireOrganizationAccess, (req, res) => {
    res.json(req.user);
  });

  // Secure user activation endpoint
  app.post("/org/:slug/api/activate", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Activation token and password are required" });
      }

      const org = await storage.getCompanyBySlug(req.params.slug);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Import secure token utilities
      const { isTokenExpired } = await import('./secure-token-utils');
      
      // Find user with matching activation token
      const user = await storage.getUserByActivationToken(token, org.id);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired activation token" });
      }

      // Check if token is expired
      if (!user.activationTokenExpires || isTokenExpired(user.activationTokenExpires)) {
        return res.status(400).json({ message: "Activation token has expired" });
      }

      // Hash the new password
      const hashedPassword = await hashPassword(password);

      // Activate user account
      await storage.activateUser(user.id, hashedPassword);

      // Auto-login the newly activated user
      const activatedUser = await storage.getUser(user.id);
      if (activatedUser) {
        req.login(activatedUser, (err) => {
          if (err) {
            console.error('Login after activation failed:', err);
            return res.status(200).json({ message: "Account activated successfully! Please login." });
          }
          res.status(200).json({ message: "Account activated successfully!", user: activatedUser });
        });
      } else {
        res.status(200).json({ message: "Account activated successfully! Please login." });
      }
    } catch (error) {
      console.error('Account activation error:', error);
      res.status(500).json({ message: "Account activation failed" });
    }
  });

  // Password reset request endpoint
  app.post("/org/:slug/api/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const org = await storage.getCompanyBySlug(req.params.slug);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Find user by email (always return success to prevent email enumeration)
      const user = await storage.getUserByEmailAndCompany(email, org.id);
      if (user && user.isActive) {
        // Import utilities and email service
        const { generatePasswordResetToken, generatePasswordResetUrl } = await import('./secure-token-utils');
        const { sendPasswordResetEmail } = await import('./email-service');
        
        // Generate secure reset token
        const { token, expires } = await generatePasswordResetToken(15); // 15 minutes
        
        // Save reset token to user
        await storage.setPasswordResetToken(user.id, token, expires);
        
        // Generate reset URL and send email
        const resetUrl = generatePasswordResetUrl(org.slug, token);
        await sendPasswordResetEmail(
          user.email,
          org.name,
          user.firstName || user.displayName || 'User',
          resetUrl
        );
      }

      // Always return success to prevent email enumeration attacks
      res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error) {
      console.error('Password reset request error:', error);
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  // Password reset completion endpoint
  app.post("/org/:slug/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({ message: "Reset token and new password are required" });
      }

      const org = await storage.getCompanyBySlug(req.params.slug);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      // Import secure token utilities
      const { isTokenExpired } = await import('./secure-token-utils');
      
      // Find user with matching reset token
      const user = await storage.getUserByPasswordResetToken(token, org.id);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      // Check if token is expired
      if (!user.passwordResetTokenExpires || isTokenExpired(user.passwordResetTokenExpires)) {
        return res.status(400).json({ message: "Reset token has expired" });
      }

      // Hash the new password and update user
      const hashedPassword = await hashPassword(password);
      await storage.resetUserPassword(user.id, hashedPassword);

      res.status(200).json({ message: "Password reset successfully! Please login with your new password." });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ message: "Password reset failed" });
    }
  });

  // Admin impersonation endpoint
  app.post("/api/admin/impersonate/:slug", requireAdminAuth, async (req, res) => {
    try {
      const org = await storage.getCompanyBySlug(req.params.slug);
      if (!org) {
        return res.status(404).json({ message: "Organization not found" });
      }

      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      console.log(`ADMIN IMPERSONATION: Admin ${req.user.username} accessing organization ${org.name} (${org.slug})`);
      
      // Create impersonation session data
      (req.session as any).adminImpersonation = {
        adminUserId: req.user.id,
        adminUsername: req.user.username,
        organizationId: org.id,
        organizationSlug: org.slug,
        organizationName: org.name,
        impersonatedAt: new Date().toISOString()
      };

      // Return admin user data with organization context
      res.json({
        ...req.user,
        impersonatingOrganization: {
          id: org.id,
          slug: org.slug,
          name: org.name
        }
      });
    } catch (error) {
      console.error('Admin impersonation error:', error);
      res.status(500).json({ message: "Failed to impersonate organization" });
    }
  });

  // Clear admin impersonation
  app.post("/api/admin/clear-impersonation", requireAdminAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      console.log(`ADMIN CLEAR IMPERSONATION: Admin ${req.user.username} clearing impersonation`);
      delete (req.session as any).adminImpersonation;
      res.json({ message: "Impersonation cleared" });
    } catch (error) {
      console.error('Clear impersonation error:', error);
      res.status(500).json({ message: "Failed to clear impersonation" });
    }
  });

  // Administrator routes (no organization context)
  app.post("/api/admin/login", async (req, res, next) => {
    try {
      console.log(`ADMIN LOGIN ATTEMPT: username=${req.body.username}`);
      
      // Import admin configuration
      const { getAdminAccessMessage, isAdministrator } = await import('../shared/admin-config');
      
      // Specifically look for admin users with null companyId
      const user = await storage.getAdminUserByUsername(req.body.username);
      console.log(`ADMIN LOGIN: Admin user lookup result:`, user ? `Found admin user ${user.username} (companyId: ${user.companyId})` : 'Admin user not found');
      
      // For admin access, we only allow specific admin users
      if (!user || !isAdministrator(user)) {
        console.log('ADMIN LOGIN: Admin user not found or not authorized');
        return res.status(401).json({ message: getAdminAccessMessage('UNAUTHORIZED') });
      }
      
      const passwordMatch = await comparePasswords(req.body.password, user.password);
      console.log('ADMIN LOGIN: Password comparison result:', passwordMatch);
      console.log('ADMIN LOGIN: Supplied password:', req.body.password);
      console.log('ADMIN LOGIN: Stored password hash:', user.password ? user.password.substring(0, 20) + '...' : 'null');
      
      if (!passwordMatch) {
        console.log('ADMIN LOGIN: Password mismatch');
        const { getAdminAccessMessage } = await import('../shared/admin-config');
        return res.status(401).json({ message: getAdminAccessMessage('UNAUTHORIZED') });
      }

      // User is already verified as admin user with null companyId

      // Update last login timestamp
      await storage.updateUserLastLogin(user.id);

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(200).json(user);
      });
    } catch (error) {
      console.error('ADMIN LOGIN ERROR:', error);
      const { getAdminRole } = await import('../shared/admin-config');
      res.status(500).json({ message: `${getAdminRole()} login failed` });
    }
  });

  app.get("/api/admin/user", async (req, res) => {
    const { isAdministrator, getAdminAccessMessage } = await import('../shared/admin-config');
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: getAdminAccessMessage() });
    }
    // Additional check for admin users using centralized configuration
    if (!isAdministrator(req.user as any)) {
      return res.status(401).json({ message: getAdminAccessMessage('INSUFFICIENT') });
    }
    res.json(req.user);
  });

  // Universal login endpoint - determines organization from user credentials
  app.post("/api/login", async (req, res, next) => {
    try {
      console.log(`UNIVERSAL LOGIN ATTEMPT: username=${req.body.username}`);
      
      // First, try to find user across all organizations
      const user = await storage.getUserByUsername(req.body.username);
      console.log(`UNIVERSAL LOGIN: User lookup result:`, user ? `Found user ${user.username} (companyId: ${user.companyId})` : 'User not found');
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (!(await comparePasswords(req.body.password, user.password))) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Get organization slug for the user's company
      let organizationSlug = null;
      if (user.companyId) {
        const company = await storage.getCompany(user.companyId);
        organizationSlug = company?.slug;
      }

      // Update last login timestamp
      await storage.updateUserLastLogin(user.id);

      req.login(user, (err) => {
        if (err) return next(err);
        
        // Return user with organization slug for frontend redirect
        res.status(200).json({
          ...user,
          organizationSlug
        });
      });
    } catch (error) {
      console.error('UNIVERSAL LOGIN ERROR:', error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Admin user management
  app.get("/api/admin/users", async (req, res) => {
    const { isAdministrator, getAdminAccessMessage } = await import('../shared/admin-config');
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: getAdminAccessMessage() });
    }
    if (!isAdministrator(req.user as any)) {
      return res.status(401).json({ message: getAdminAccessMessage('INSUFFICIENT') });
    }
    try {
      // Direct database query as workaround for compilation issues
      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      const { isNull } = await import("drizzle-orm");
      
      const adminUsers = await db.select().from(users).where(isNull(users.companyId));
      res.json(adminUsers);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ message: "Failed to fetch admin users" });
    }
  });

  app.post("/api/admin/users", async (req, res) => {
    const { isAdministrator, getAdminAccessMessage, ADMIN_CONFIG } = await import('../shared/admin-config');
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: getAdminAccessMessage() });
    }
    if (!isAdministrator(req.user as any)) {
      return res.status(401).json({ message: getAdminAccessMessage('INSUFFICIENT') });
    }
    try {
      const { insertAdminUserSchema } = await import('@shared/schema');
      console.log('CREATE ADMIN: Request body:', req.body);
      
      const adminUserData = insertAdminUserSchema.parse(req.body);
      console.log('CREATE ADMIN: Parsed data:', adminUserData);
      
      // Hash password for admin users
      if (!adminUserData.password) {
        return res.status(400).json({ message: "Password is required" });
      }
      const hashedPassword = await hashPassword(adminUserData.password);
      
      // Create admin user (organization-independent) using centralized configuration
      const userData = {
        ...adminUserData,
        password: hashedPassword,
        companyId: ADMIN_CONFIG.COMPANY_INDICATORS.ADMIN_COMPANY_ID, // Admin users are organization-independent
        role: 'administrator',
      };
      console.log('CREATE ADMIN: Final user data:', { ...userData, password: '[HIDDEN]' });
      
      const adminUser = await storage.createUser(userData);
      console.log('CREATE ADMIN: User created successfully:', adminUser.username);
      
      // Remove password from response for security
      const { password, ...safeUser } = adminUser;
      res.json(safeUser);
    } catch (error) {
      console.error('Error creating admin user:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
      }
      res.status(500).json({ 
        message: "Failed to create admin user", 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    const { isAdministrator, getAdminAccessMessage } = await import('../shared/admin-config');
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: getAdminAccessMessage() });
    }
    if (!isAdministrator(req.user as any)) {
      return res.status(401).json({ message: getAdminAccessMessage('INSUFFICIENT') });
    }
    try {
      const { insertAdminUserSchema } = await import('@shared/schema');
      const userId = parseInt(req.params.id);
      const updateData = insertAdminUserSchema.partial().parse(req.body);
      
      // Hash password if provided
      if (updateData.password) {
        updateData.password = await hashPassword(updateData.password);
      }
      
      const updatedUser = await storage.updateUser(userId, updateData);
      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating admin user:', error);
      res.status(500).json({ message: "Failed to update admin user" });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    const { isAdministrator, getAdminAccessMessage, ADMIN_CONFIG } = await import('../shared/admin-config');
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: getAdminAccessMessage() });
    }
    if (!isAdministrator(req.user as any)) {
      return res.status(401).json({ message: getAdminAccessMessage('INSUFFICIENT') });
    }
    try {
      const userId = parseInt(req.params.id);
      
      // Prevent deletion of primary admin user using centralized configuration
      const user = await storage.getUser(userId);
      if (user?.username === ADMIN_CONFIG.DEFAULT_ADMIN.USERNAME) {
        return res.status(400).json({ message: `Cannot delete primary ${ADMIN_CONFIG.DEFAULT_ADMIN.ROLE.toLowerCase()} user` });
      }
      
      await storage.deleteUser(userId);
      res.json({ message: "Admin user deleted successfully" });
    } catch (error) {
      console.error('Error deleting admin user:', error);
      res.status(500).json({ message: "Failed to delete admin user" });
    }
  });

  // Logout routes
  app.post("/api/admin/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Admin logout error:', err);
        return res.status(500).json({ message: "Logout failed" });
      }
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ message: "Session cleanup failed" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  app.post("/org/:slug/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        console.error('Organization logout error:', err);
        return res.status(500).json({ message: "Logout failed" });
      }
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ message: "Session cleanup failed" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    });
  });
}