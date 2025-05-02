/**
 * tag-manager.js - Framework-agnostic tag management for digital twin visualizations
 * 
 * This module provides a common interface for creating, managing, and updating
 * interactive HTML tags that can be attached to 3D objects in different visualization frameworks.
 */

class TagManager {
    /**
     * Create a new TagManager
     * @param {HTMLElement} container - The container element to add tags to
     */
    constructor(container) {
        this.container = container;
        this.tags = {};
        this.hoveredTag = null;
        // Removed focusedTag since we're removing the click system
        this.showTags = true;
        
        // Distance-based visibility settings
        this.proximityThreshold = 30; // Units depend on the scene scale
        this.closeProximityThreshold = 15; // Threshold for close proximity (highlight without hover)
        
        // Dynamic scaling parameters
        this.minDistance = 5;  // Closest distance for maximum scale
        this.maxDistance = 30; // Furthest distance for minimum scale
        
        // Style properties
        this.tagBaseOpacity = 0.6;
        this.tagFocusOpacity = 0.9;
        this.tagMediumOpacity = 0.8; 
        this.tagBaseScale = 0.6;   // Scale at max distance
        this.tagFocusScale = 1.0;  // Scale when hovered
        this.tagMediumScale = 0.85;
        this.tagMaxScale = 1.4;    // Maximum scale when very close
        this.tagScaleTransition = 0.2;
        
        // Callback functions - removing focus callbacks
        this.onTagUnfocused = null;
        
        // Highlight timers for content changes
        this.highlightTimers = {};
        this.highlightDuration = 3000; // 3 seconds
        
        this.setupContainer();
    }
    
    /**
     * Set up the tag container element
     */
    setupContainer() {
        // Create a container for all tags and position it relative to the visualization container
        this.tagContainer = document.createElement('div');
        this.tagContainer.className = 'floating-tags-container';
        this.tagContainer.style.position = 'absolute';
        this.tagContainer.style.top = '0';
        this.tagContainer.style.left = '0';
        this.tagContainer.style.width = '100%';
        this.tagContainer.style.height = '100%';
        this.tagContainer.style.pointerEvents = 'none';
        this.tagContainer.style.overflow = 'hidden'; // Prevent tags from showing outside container
        this.tagContainer.style.zIndex = '10'; // Set z-index higher than scene but lower than other UI elements
        
        this.container.style.position = 'relative'; // Ensure container has relative positioning
        this.container.appendChild(this.tagContainer);
    }
    
    /**
     * Create a new tag
     * @param {string} id - Unique identifier for the tag
     * @param {string} content - HTML content for the tag
     * @param {string} type - Tag type (used for updating content)
     * @returns {HTMLElement} - The created tag element
     */
    createTag(id, content, type) {
        // Create text using HTML and CSS
        const tagElement = document.createElement('div');
        tagElement.className = 'floating-tag';
        tagElement.id = `tag-${id}`;
        tagElement.style.position = 'absolute';
        tagElement.style.padding = '8px';
        tagElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        tagElement.style.color = 'white';
        tagElement.style.borderRadius = '5px';
        tagElement.style.fontSize = '12px';
        tagElement.style.fontFamily = 'Arial, sans-serif';
        tagElement.style.width = 'auto';
        tagElement.style.textAlign = 'left';
        tagElement.style.display = this.showTags ? 'block' : 'none';
        tagElement.style.transform = `translate(-50%, -50%) scale(${this.tagBaseScale})`;
        tagElement.style.opacity = this.tagBaseOpacity.toString();
        tagElement.style.transition = `transform ${this.tagScaleTransition}s ease-out, opacity ${this.tagScaleTransition}s ease-out`;
        tagElement.innerHTML = content;
        
        // Make tag element receive pointer events
        tagElement.style.pointerEvents = 'auto';
        tagElement.style.cursor = 'pointer';
        
        // Setup interactions
        this.setupTagInteraction(tagElement, id);
        
        this.tagContainer.appendChild(tagElement);
        
        // Store reference to tag
        this.tags[id] = {
            element: tagElement,
            type: type
        };
        
        return tagElement;
    }
    
    /**
     * Update a tag's position
     * @param {string} id - Tag ID
     * @param {number} x - X coordinate (pixels)
     * @param {number} y - Y coordinate (pixels)
     * @param {boolean} visible - Whether tag should be visible
     * @param {number} distance - Distance from camera to object (optional)
     */
    updateTagPosition(id, x, y, visible, distance = Infinity) {
        const tag = this.tags[id];
        if (!tag) return;
        
        // Store position and distance data
        tag.x = x;
        tag.y = y;
        tag.distance = distance;
        
        // Check distance-based visibility conditions
        const isWithinProximity = distance <= this.proximityThreshold;
        const isWithinCloseProximity = distance <= this.closeProximityThreshold;
        
        // Tag is visible if:
        // 1. Tags are globally enabled AND
        // 2. The tag is within the camera view AND
        // 3. Either: it's within proximity range OR it's hovered OR it's temporarily highlighted
        const isVisible = this.showTags && 
            visible && 
            (isWithinProximity || id === this.hoveredTag || tag.temporarilyHighlighted);
        
        if (isVisible) {
            tag.element.style.left = `${x}px`;
            tag.element.style.top = `${y}px`;
            tag.element.style.display = 'block';
            
            // Calculate dynamic scale based on distance - closer = bigger
            let scale, opacity, zIndex;
            
            // Determine the visual state based on interaction state and distance
            if (id === this.hoveredTag || tag.temporarilyHighlighted) {
                // Fully highlighted state
                scale = this.tagFocusScale;
                opacity = this.tagFocusOpacity;
                zIndex = '100';
            } 
            else if (distance <= this.maxDistance) {
                // Dynamic scaling based on distance
                // Map distance between minDistance and maxDistance to a scale value
                // Normal distance scaling: closer = larger
                const normalizedDistance = Math.max(0, Math.min(1, (distance - this.minDistance) / 
                                                            (this.maxDistance - this.minDistance)));
                
                // For very close distances (< closeProximityThreshold)
                if (isWithinCloseProximity) {
                    // Enhanced scale when close - scales from medium scale up to max scale
                    const closeScaleRange = this.tagMaxScale - this.tagMediumScale;
                    const closeProximityFactor = Math.max(0, Math.min(1, 
                                                        (distance - this.minDistance) / 
                                                        (this.closeProximityThreshold - this.minDistance)));
                    
                    scale = this.tagMaxScale - (closeProximityFactor * closeScaleRange);
                    opacity = this.tagMediumOpacity;
                    zIndex = '50';
                } else {
                    // Normal distance range - scales from base scale to medium scale
                    const normalScaleRange = this.tagMediumScale - this.tagBaseScale;
                    const normalizedFactor = Math.max(0, Math.min(1, 
                                                    (distance - this.closeProximityThreshold) / 
                                                    (this.maxDistance - this.closeProximityThreshold)));
                    
                    scale = this.tagMediumScale - (normalizedFactor * normalScaleRange);
                    opacity = this.tagBaseOpacity + ((1 - normalizedDistance) * 0.2); // Gradually increase opacity too
                    zIndex = '10';
                }
            } else {
                // Default state for visible but distant tags
                scale = this.tagBaseScale;
                opacity = this.tagBaseOpacity;
                zIndex = '10';
            }
            
            // Don't override scale/opacity if the tag is temporarily highlighted
            if (!tag.temporarilyHighlighted) {
                // Apply the calculated scale
                tag.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
                tag.element.style.opacity = opacity.toString();
                tag.element.style.zIndex = zIndex;
            }
        } else {
            tag.element.style.display = 'none';
            
            // If tag is no longer visible, ensure it's not stuck in hover state
            if (this.hoveredTag === id) {
                this.hoveredTag = null;
                this.updateTagVisualState(id, false);
            }
        }
    }
    
    /**
     * Update a tag's content
     * @param {string} id - Tag ID
     * @param {string} content - New HTML content for the tag
     */
    updateTagContent(id, content) {
        const tag = this.tags[id];
        if (!tag) return;
        
        tag.element.innerHTML = content;
    }
    
    /**
     * Update a tag's style
     * @param {string} id - Tag ID
     * @param {Object} styles - CSS styles to apply
     */
    updateTagStyle(id, styles) {
        const tag = this.tags[id];
        if (!tag) return;
        
        Object.keys(styles).forEach(property => {
            tag.element.style[property] = styles[property];
        });
    }
    
    /**
     * Set up mouse interaction for a tag element
     * @param {HTMLElement} tagElement - The tag element
     * @param {string} tagId - ID of the tag
     */
    setupTagInteraction(tagElement, tagId) {
        // Mouse enter - highlight tag
        tagElement.addEventListener('mouseenter', () => {
            this.hoveredTag = tagId;
            this.updateTagVisualState(tagId, true);
        });
        
        // Mouse leave - remove highlight
        tagElement.addEventListener('mouseleave', () => {
            this.hoveredTag = null;
            this.updateTagVisualState(tagId, false);
        });
        
        // Removed click handler since we're removing the click/focus functionality
    }
    
    /**
     * Update the visual state of a tag based on hover state
     * @param {string} tagId - ID of the tag
     * @param {boolean} highlight - Whether to highlight the tag
     */
    updateTagVisualState(tagId, highlight) {
        const tag = this.tags[tagId];
        if (!tag || !tag.element) return;
        
        const element = tag.element;
        
        if (highlight) {
            // Highlight the tag - make it more visible and larger
            element.style.opacity = this.tagFocusOpacity.toString();
            element.style.transform = `translate(-50%, -50%) scale(${this.tagFocusScale})`;
            element.style.zIndex = '100'; // Bring to front
        } else {
            // Return to normal state
            element.style.opacity = this.tagBaseOpacity.toString();
            element.style.transform = `translate(-50%, -50%) scale(${this.tagBaseScale})`;
            element.style.zIndex = '10';
        }
    }
    
    /**
     * Toggle visibility of all tags
     * @param {boolean} visible - Whether tags should be visible
     */
    toggleTags(visible) {
        this.showTags = visible !== undefined ? visible : !this.showTags;
        
        Object.keys(this.tags).forEach(tagId => {
            const tag = this.tags[tagId];
            if (tag && tag.element) {
                tag.element.style.display = this.showTags ? 'block' : 'none';
            }
        });
    }
    
    /**
     * Remove a tag
     * @param {string} id - ID of the tag to remove
     */
    removeTag(id) {
        const tag = this.tags[id];
        if (!tag) return;
        
        if (tag.element && tag.element.parentNode) {
            tag.element.parentNode.removeChild(tag.element);
        }
        
        delete this.tags[id];
    }
    
    /**
     * Clean up all tags and the tag container
     */
    cleanup() {
        Object.keys(this.tags).forEach(id => this.removeTag(id));
        
        if (this.tagContainer && this.tagContainer.parentNode) {
            this.tagContainer.parentNode.removeChild(this.tagContainer);
        }
    }
    
    /**
     * Set callback for tag unfocus events
     * Keeping this for backward compatibility but it's not used anymore
     * @param {Function} callback - Function to call when a tag is unfocused
     */
    setTagUnfocusCallback(callback) {
        this.onTagUnfocused = callback;
    }
    
    /**
     * Set callback for tag focus events
     * Keeping this for backward compatibility but it's not used anymore
     * @param {Function} callback - Function to call when a tag is focused
     */
    setTagFocusCallback(callback) {
        // Empty method for backward compatibility
    }
    
    /**
     * Set the proximity threshold for tag visibility
     * @param {number} threshold - New threshold value
     */
    setProximityThreshold(threshold) {
        this.proximityThreshold = threshold;
    }
    
    /**
     * Set the close proximity threshold for enhanced tag visibility
     * @param {number} threshold - New threshold value
     */
    setCloseProximityThreshold(threshold) {
        if (threshold > 0 && threshold <= this.proximityThreshold) {
            this.closeProximityThreshold = threshold;
        }
    }
    
    /**
     * Set distance range for dynamic tag scaling
     * @param {number} minDist - Minimum distance (where tag will be at max scale)
     * @param {number} maxDist - Maximum distance (where tag will be at min scale)
     */
    setScalingDistanceRange(minDist, maxDist) {
        if (minDist > 0 && maxDist > minDist) {
            this.minDistance = minDist;
            this.maxDistance = maxDist;
        }
    }
    
    /**
     * Set maximum scale for tags when very close to objects
     * @param {number} maxScale - Maximum scale factor
     */
    setMaximumScale(maxScale) {
        if (maxScale > this.tagFocusScale) {
            this.tagMaxScale = maxScale;
        }
    }
}

// Export the TagManager class for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TagManager;
} else {
    window.TagManager = TagManager;
}