import * as fs from 'fs';
import * as path from 'path';

/**
 * Load configuration from JSON file
 */
export function loadConfig<T>(configPath: string): T {
    try {
        const fullPath = path.resolve(configPath);
        const configContent = fs.readFileSync(fullPath, 'utf-8');
        return JSON.parse(configContent) as T;
    } catch (error) {
        throw new Error(`Failed to load configuration from ${configPath}: ${error}`);
    }
}

/**
 * Get environment-specific configuration path
 */
export function getEnvironmentConfigPath(environment: string): string {
    return path.join('config', 'environments', `${environment}.json`);
}

/**
 * Load environment configuration with fallback to default
 */
export function loadEnvironmentConfig<T>(environment: string, defaultConfig?: Partial<T>): T {
    const configPath = getEnvironmentConfigPath(environment);

    try {
        const config = loadConfig<T>(configPath);
        return { ...defaultConfig, ...config } as T;
    } catch (error) {
        if (defaultConfig) {
            console.warn(`Warning: Could not load config for ${environment}, using defaults`);
            return defaultConfig as T;
        }
        throw error;
    }
}

/**
 * Get CDK context value with type safety
 */
export function getContextValue(app: any, key: string, defaultValue?: string): string {
    const value = app.node.tryGetContext(key);
    if (value === undefined && defaultValue === undefined) {
        throw new Error(`Required context value '${key}' not found. Use -c ${key}=<value>`);
    }
    return value || defaultValue;
}