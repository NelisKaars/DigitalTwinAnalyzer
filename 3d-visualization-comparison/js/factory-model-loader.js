/**
 * factory-model-loader.js
 * Common utilities for loading factory model components across different frameworks
 */

const FactoryModelLoader = {
    /**
     * Get loading sequence for factory components
     * @returns {Object} Component loading sequence information
     */
    getLoadingSequence() {
        return {
            // Order of component loading - allows other frameworks to follow the same sequence
            sequence: ['environment', 'waterTank', 'cookieLines', 'mixers'],
            // Number of mixer models to load (for performance)
            maxMixers: 6
        };
    },
    
    /**
     * Generate procedural textures for components based on their type
     * @param {string} componentType - Type of component (conveyor, plasticLiner, etc.)
     * @param {Object} options - Framework-specific options for texture generation
     * @returns {Object} Canvas or texture data that can be used by any framework
     */
    generateProceduralTexture(componentType, options = {}) {
        // Get standard parameters from VisualizationComponents
        const params = this.getTextureParameters(componentType);
        
        // Create a canvas with the texture
        const canvas = document.createElement('canvas');
        canvas.width = params.textureSize;
        canvas.height = params.textureSize;
        const ctx = canvas.getContext('2d');
        
        // Draw base color
        ctx.fillStyle = params.baseColor;
        ctx.fillRect(0, 0, params.textureSize, params.textureSize);
        
        // Draw pattern based on component type
        ctx.fillStyle = params.patternColor;
        
        if (componentType === 'conveyor') {
            // Draw horizontal stripes for conveyor
            const stripeHeight = params.textureSize / params.stripeCount;
            for (let i = 0; i < params.stripeCount; i += 2) {
                ctx.fillRect(0, i * stripeHeight, params.textureSize, stripeHeight);
            }
        } 
        else if (componentType === 'plasticLiner') {
            // Draw vertical lines for plastic liner
            const lineWidth = params.textureSize / params.lineCount;
            for (let i = 0; i < params.lineCount; i += 2) {
                ctx.fillRect(i * lineWidth, 0, lineWidth, params.textureSize);
            }
        }
        
        return {
            canvas: canvas,
            params: params
        };
    },
    
    /**
     * Get texture parameter settings for different component types
     * @param {string} componentType - Type of component
     * @returns {Object} Texture parameters
     */
    getTextureParameters(componentType) {
        const defaults = {
            textureSize: 512,
            baseColor: '#555555',
            patternColor: '#777777',
            repeat: [2, 2]
        };
        
        switch (componentType) {
            case 'conveyor':
                return {
                    ...defaults,
                    stripeCount: 10,
                    repeat: [4, 2]
                };
                
            case 'plasticLiner':
                return {
                    ...defaults,
                    lineCount: 8,
                    repeat: [2, 4]
                };
                
            default:
                return defaults;
        }
    },
    
    /**
     * Helper to identify component types based on node names
     * @param {string} nodeName - Name of the node/component
     * @returns {string|null} - Component type or null if not identified
     */
    identifyComponentType(nodeName) {
        const name = nodeName.toLowerCase();
        
        // Freezer tunnel
        if (name.includes('freezer') || name.includes('tunnel')) {
            return 'freezerTunnel';
        }
        // Plastic liner
        else if (name.includes('plastic') || name.includes('liner')) {
            return 'plasticLiner';
        }
        // Cookie former
        else if ((name.includes('cookie') && name.includes('form')) || name.includes('former')) {
            return 'cookieFormer';
        }
        // Box sealer
        else if (name.includes('box') && (name.includes('seal') || name.includes('erect'))) {
            return 'boxSealer';
        }
        // Conveyor sections
        else if (name.includes('conveyor') || name.includes('belt')) {
            return 'conveyorSystem';
        }
        
        return null;
    },
    
    /**
     * Check if all required components for a factory model are loaded
     * 
     * @param {Object} loadState - The current loading state of models
     * @param {Object} loadState.factoryEnvironment - The factory environment model (if loaded)
     * @param {Object} loadState.waterTankObject - The water tank model (if loaded)
     * @param {Array} loadState.cookieLines - Array of loaded cookie lines
     * @param {Array} loadState.mixerModels - Array of loaded mixer models
     * @param {Object} loadState.factoryScene - The factory scene definition
     * @returns {boolean} True if all necessary components are loaded
     */
    checkAllFactoryModelsLoaded(loadState) {
        const requiredComponentCount = 2 + loadState.factoryScene.cookieLines.length; // Environment + WaterTank + Lines
        const expectedMixerCount = Math.min(6, loadState.factoryScene.mixers.length);
        const loadedComponentCount = (loadState.factoryEnvironment ? 1 : 0) +
            (loadState.waterTankObject ? 1 : 0) +
            loadState.cookieLines.length;

        return (loadedComponentCount >= requiredComponentCount && 
                loadState.mixerModels.length >= expectedMixerCount);
    },
    
    /**
     * Check if all required components are loaded
     * @param {Object} loadState - Current loading state object
     * @returns {boolean} - True if all components are loaded
     */
    checkAllComponentsLoaded(loadState) {
        const { environment, waterTank, cookieLines, mixers, requiredLineCount, maxMixerCount } = loadState;
        
        const requiredComponentCount = 2 + requiredLineCount; // Environment + WaterTank + Lines
        const loadedComponentCount = (environment ? 1 : 0) +
            (waterTank ? 1 : 0) +
            (cookieLines || 0);
        
        return loadedComponentCount >= requiredComponentCount && 
               (mixers || 0) >= Math.min(maxMixerCount, 6);
    }
};

// Export the FactoryModelLoader for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FactoryModelLoader;
} else {
    window.FactoryModelLoader = FactoryModelLoader;
}