import * as ftp from 'basic-ftp';

export interface FtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure?: boolean;
  basePath?: string;
}

export async function testFtpConnection(config: FtpConfig): Promise<{ success: boolean; message: string }> {
  const client = new ftp.Client();
  
  try {
    // Set timeout (using client timeout instead of ftp.timeout)
    client.timeout = 10000; // 10 seconds
    
    console.log(`Testing FTP connection to ${config.host}:${config.port}`);
    
    await client.access({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      secure: config.secure || false
    });

    // Test basic operations
    const workingDir = await client.pwd();
    console.log(`FTP connection successful. Working directory: ${workingDir}`);
    
    // If basePath is specified, try to change to it
    if (config.basePath && config.basePath !== '/') {
      try {
        await client.cd(config.basePath);
        console.log(`Successfully changed to base path: ${config.basePath}`);
      } catch (error) {
        console.warn(`Could not change to base path ${config.basePath}:`, error.message);
        return { 
          success: false, 
          message: `FTP connection successful but cannot access base path: ${config.basePath}` 
        };
      }
    }

    return { 
      success: true, 
      message: `FTP connection successful to ${config.host}` 
    };
    
  } catch (error: any) {
    console.error('FTP connection failed:', error.message);
    return { 
      success: false, 
      message: `FTP connection failed: ${error.message}` 
    };
  } finally {
    client.close();
  }
}

export async function listFtpFiles(config: FtpConfig, directory?: string): Promise<string[]> {
  const client = new ftp.Client();
  
  try {
    await client.access({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      secure: config.secure || false
    });

    if (directory) {
      await client.cd(directory);
    } else if (config.basePath) {
      await client.cd(config.basePath);
    }

    const fileList = await client.list();
    return fileList.map(file => file.name);
    
  } catch (error: any) {
    console.error('FTP list files failed:', error.message);
    throw error;
  } finally {
    client.close();
  }
}

export async function downloadFtpFile(
  config: FtpConfig, 
  remoteFile: string, 
  localFile: string
): Promise<void> {
  const client = new ftp.Client();
  
  try {
    await client.access({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      secure: config.secure || false
    });

    if (config.basePath) {
      await client.cd(config.basePath);
    }

    await client.downloadTo(localFile, remoteFile);
    console.log(`Successfully downloaded ${remoteFile} to ${localFile}`);
    
  } catch (error: any) {
    console.error('FTP download failed:', error.message);
    throw error;
  } finally {
    client.close();
  }
}
