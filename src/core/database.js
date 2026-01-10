const fs = require('fs').promises;
const path = require('path');
const { getProjectDatabasePath } = require('./project');
const { print } = require('../frame/channel');

/**
 * 数据库管理器 - 统一管理数据访问和缓存
 */
class DatabaseManager {
    constructor() {
        this.cache = {
            functionDefinitions: null,
            functionCalls: null,
            lastScanTime: null
        };
        this.cacheTimestamp = 0;
        this.fileNames = {
            definitions: 'function_definitions.json',
            calls: 'function_calls.json',
            timestamp: 'last_scan_timestamp.json'
        };
    }

    /**
     * 清空缓存
     */
    clearCache() {
        this.cache = {
            functionDefinitions: null,
            functionCalls: null,
            lastScanTime: null
        };
        this.cacheTimestamp = 0;
        print('debug', 'Cache cleared.');
    }

    /**
     * 检查缓存是否有效
     * @returns {boolean}
     */
    isCacheValid() {
        const cacheAge = Date.now() - this.cacheTimestamp;
        const maxAge = 5 * 60 * 1000; // 5分钟缓存有效期
        return this.cache.functionDefinitions !== null && cacheAge < maxAge;
    }

    /**
     * 加载所有数据到缓存
     * @param {boolean} forceReload 是否强制重新加载
     */
    async loadCache(forceReload = false) {
        if (!forceReload && this.isCacheValid()) {
            print('debug', 'Using cached data.');
            return;
        }

        try {
            const dbPath = await getProjectDatabasePath();
            
            // 并行加载所有数据
            const [defData, callData, timeData] = await Promise.all([
                fs.readFile(path.join(dbPath, this.fileNames.definitions), 'utf-8').catch(() => '{}'),
                fs.readFile(path.join(dbPath, this.fileNames.calls), 'utf-8').catch(() => '{}'),
                fs.readFile(path.join(dbPath, this.fileNames.timestamp), 'utf-8').catch(() => '{"lastScanTime":0}')
            ]);

            this.cache.functionDefinitions = JSON.parse(defData);
            this.cache.functionCalls = JSON.parse(callData);
            this.cache.lastScanTime = JSON.parse(timeData).lastScanTime || 0;
            this.cacheTimestamp = Date.now();

            print('info', 'Database cache loaded successfully.');
        } catch (error) {
            print('error', 'Failed to load database cache.', error);
            // 初始化为空对象，避免后续错误
            this.cache.functionDefinitions = {};
            this.cache.functionCalls = {};
            this.cache.lastScanTime = 0;
        }
    }

    /**
     * 保存所有数据
     * @param {Object} functionDefinitions 函数定义数据
     * @param {Object} functionCalls 函数调用数据
     */
    async saveAll(functionDefinitions, functionCalls) {
        try {
            const dbPath = await getProjectDatabasePath();
            const timestamp = Date.now();

            // 并行保存所有数据
            await Promise.all([
                fs.writeFile(
                    path.join(dbPath, this.fileNames.definitions),
                    JSON.stringify(functionDefinitions, null, 2)
                ),
                fs.writeFile(
                    path.join(dbPath, this.fileNames.calls),
                    JSON.stringify(functionCalls, null, 2)
                ),
                fs.writeFile(
                    path.join(dbPath, this.fileNames.timestamp),
                    JSON.stringify({ lastScanTime: timestamp }, null, 2)
                )
            ]);

            // 更新缓存
            this.cache.functionDefinitions = functionDefinitions;
            this.cache.functionCalls = functionCalls;
            this.cache.lastScanTime = timestamp;
            this.cacheTimestamp = Date.now();

            print('info', 'Database saved successfully.');
        } catch (error) {
            print('error', 'Failed to save database.', error);
            throw error;
        }
    }

    /**
     * 获取函数定义
     * @param {string} functionName 函数名
     * @returns {Promise<Array>}
     */
    async getFunctionDefinitions(functionName) {
        try {
            await this.loadCache();
            const result = this.cache.functionDefinitions[functionName] || [];
            print('debug', `Function definitions for: ${functionName}, count: ${result.length}`);
            return result;
        } catch (error) {
            print('error', 'Failed to get function definitions.', error);
            return [];
        }
    }

    /**
     * 获取函数调用关系
     * @param {string} functionName 函数名
     * @returns {Promise<Object>}
     */
    async getFunctionCalls(functionName) {
        try {
            await this.loadCache();
            const result = {
                [functionName]: this.cache.functionCalls[functionName] || { calledBy: [] }
            };
            print('debug', `Function calls for: ${functionName}, callers: ${result[functionName].calledBy.length}`);
            return result;
        } catch (error) {
            print('error', 'Failed to get function calls.', error);
            return {
                [functionName]: { calledBy: [] }
            };
        }
    }

    /**
     * 获取上次扫描时间
     * @returns {Promise<number>}
     */
    async getLastScanTime() {
        try {
            await this.loadCache();
            return this.cache.lastScanTime;
        } catch (error) {
            print('error', 'Failed to get last scan time.', error);
            return 0;
        }
    }

    /**
     * 获取所有函数定义数据
     * @returns {Promise<Object>}
     */
    async getAllDefinitions() {
        await this.loadCache();
        return this.cache.functionDefinitions || {};
    }

    /**
     * 获取所有函数调用数据
     * @returns {Promise<Object>}
     */
    async getAllCalls() {
        await this.loadCache();
        return this.cache.functionCalls || {};
    }

    /**
     * 获取数据库统计信息
     * @returns {Promise<Object>}
     */
    async getStatistics() {
        try {
            await this.loadCache();
            const defCount = Object.keys(this.cache.functionDefinitions || {}).length;
            const callCount = Object.keys(this.cache.functionCalls || {}).length;
            
            return {
                functionsCount: defCount,
                callRelationsCount: callCount,
                lastScanTime: this.cache.lastScanTime,
                cacheAge: Date.now() - this.cacheTimestamp
            };
        } catch (error) {
            print('error', 'Failed to get statistics.', error);
            return {
                functionsCount: 0,
                callRelationsCount: 0,
                lastScanTime: 0,
                cacheAge: 0
            };
        }
    }
}

// 单例模式
let instance = null;

/**
 * 获取数据库管理器实例
 * @returns {DatabaseManager}
 */
function getDatabaseManager() {
    if (!instance) {
        instance = new DatabaseManager();
    }
    return instance;
}

module.exports = {
    DatabaseManager,
    getDatabaseManager
};
