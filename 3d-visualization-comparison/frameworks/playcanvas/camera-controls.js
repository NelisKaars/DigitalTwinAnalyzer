/**
 * PlayCanvas Camera Controls
 * Provides orbit camera controls for PlayCanvas visualizer
 */

class PlayCanvasCameraControls {
    constructor(app, camera) {
        this.app = app;
        this.cameraEntity = camera;
        
        // Camera control variables
        this.cameraOrbit = {
            distance: 200,
            yaw: 0,
            pitch: 0.5,
            targetPosition: new pc.Vec3(35, 0, 75),
            minPitch: -0.5,
            maxPitch: 0.9,
            minDistance: 5,
            maxDistance: 500,
            damping: 0.05
        };
        
        // Input tracking for mouse/touch interaction
        this.input = {
            mouse: {
                isDown: false,
                lastX: 0,
                lastY: 0,
                isPanning: false
            },
            touch: {
                isDown: false,
                lastX: 0,
                lastY: 0
            }
        };
        
        // Initialize camera position
        this.updateCameraTransform();
        
        // Setup event handlers
        this.setupEventHandlers();
    }
    
    /**
     * Setup mouse and touch event handlers
     */
    setupEventHandlers() {
        const mouse = this.app.mouse;
        const touch = this.app.touch;
        
        if (mouse) {
            mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
            mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
            mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
            mouse.on(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);
        }
        
        if (touch) {
            touch.on(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
            touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
            touch.on(pc.EVENT_TOUCHEND, this.onTouchEnd, this);
            touch.on(pc.EVENT_TOUCHCANCEL, this.onTouchEnd, this);
        }
    }
    
    /**
     * Remove event handlers
     */
    removeEventHandlers() {
        const mouse = this.app.mouse;
        const touch = this.app.touch;
        
        if (mouse) {
            mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
            mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
            mouse.off(pc.EVENT_MOUSEUP, this.onMouseUp, this);
            mouse.off(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);
        }
        
        if (touch) {
            touch.off(pc.EVENT_TOUCHSTART, this.onTouchStart, this);
            touch.off(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
            touch.off(pc.EVENT_TOUCHEND, this.onTouchEnd, this);
            touch.off(pc.EVENT_TOUCHCANCEL, this.onTouchEnd, this);
        }
    }
    
    /**
     * Update camera position and rotation based on orbit parameters
     */
    updateCameraTransform() {
        // Calculate camera position based on spherical coordinates
        const orbit = this.cameraOrbit;
        const sinYaw = Math.sin(orbit.yaw);
        const cosYaw = Math.cos(orbit.yaw);
        const sinPitch = Math.sin(orbit.pitch);
        const cosPitch = Math.cos(orbit.pitch);
        
        // Calculate camera position in spherical coordinates
        const x = orbit.targetPosition.x + orbit.distance * cosPitch * sinYaw;
        const y = orbit.targetPosition.y + orbit.distance * sinPitch;
        const z = orbit.targetPosition.z + orbit.distance * cosPitch * cosYaw;
        
        // Set camera position
        this.cameraEntity.setPosition(x, y, z);
        
        // Make camera look at target position
        this.cameraEntity.lookAt(orbit.targetPosition);
    }
    
    /**
     * Handler for mouse down events
     * @param {Object} event - Mouse event
     */
    onMouseDown(event) {
        // Left mouse button (for rotation)
        if (event.button === 0) {
            this.input.mouse.isDown = true;
            this.input.mouse.lastX = event.x;
            this.input.mouse.lastY = event.y;
            
            // Prevent default to avoid text selection
            event.event.preventDefault();
        }
        // Middle mouse button (for panning)
        else if (event.button === 2) {
            this.input.mouse.isPanning = true;
            this.input.mouse.lastX = event.x;
            this.input.mouse.lastY = event.y;
            
            event.event.preventDefault();
        }
    }
    
    /**
     * Handler for mouse move events
     * @param {Object} event - Mouse event
     */
    onMouseMove(event) {
        // Handle rotation with left mouse button
        if (this.input.mouse.isDown) {
            // Calculate mouse movement deltas
            const dx = event.x - this.input.mouse.lastX;
            const dy = event.y - this.input.mouse.lastY;
            this.input.mouse.lastX = event.x;
            this.input.mouse.lastY = event.y;
            
            // Rotate camera based on mouse movement
            this.cameraOrbit.yaw -= dx * 0.003;
            this.cameraOrbit.pitch += dy * 0.003;
            
            // Clamp pitch to avoid camera flipping
            this.cameraOrbit.pitch = Math.max(this.cameraOrbit.minPitch, 
                                              Math.min(this.cameraOrbit.pitch, this.cameraOrbit.maxPitch));
            
            // Update camera position
            this.updateCameraTransform();
            
            // Prevent default to avoid text selection
            event.event.preventDefault();
        }
        // Handle panning with right mouse button
        else if (this.input.mouse.isPanning) {
            // Calculate mouse movement deltas
            const dx = event.x - this.input.mouse.lastX;
            const dy = event.y - this.input.mouse.lastY;
            this.input.mouse.lastX = event.x;
            this.input.mouse.lastY = event.y;
            
            // Get camera right and up vectors
            const right = this.cameraEntity.right;
            const up = this.cameraEntity.up;
            
            // Scale movement speed based on distance (faster when zoomed out)
            const panSpeed = this.cameraOrbit.distance * 0.005;
            
            // Calculate the pan amount in world space
            const panX = right.x * dx * panSpeed;
            const panY = up.y * dy * panSpeed;
            const panZ = right.z * dx * panSpeed + up.z * dy * panSpeed;
            
            // Update the target position
            this.cameraOrbit.targetPosition.x -= panX;
            this.cameraOrbit.targetPosition.y -= panY;
            this.cameraOrbit.targetPosition.z -= panZ;
            
            // Update camera position
            this.updateCameraTransform();
            
            event.event.preventDefault();
        }
    }
    
    /**
     * Handler for mouse up events
     * @param {Object} event - Mouse event
     */
    onMouseUp(event) {
        // Left mouse button (rotation)
        if (event.button === 0) {
            this.input.mouse.isDown = false;
        }
        // Right mouse button (panning)
        else if (event.button === 2) {
            this.input.mouse.isPanning = false;
        }
    }
    
    /**
     * Handler for mouse wheel events
     * @param {Object} event - Mouse wheel event
     */
    onMouseWheel(event) {
        // Adjust camera distance based on wheel delta
        const wheelDelta = event.wheelDelta;
        this.cameraOrbit.distance += wheelDelta * 5;
        
        // Clamp distance
        this.cameraOrbit.distance = Math.max(this.cameraOrbit.minDistance, 
                                           Math.min(this.cameraOrbit.distance, this.cameraOrbit.maxDistance));
        
        // Update camera position
        this.updateCameraTransform();
    }
    
    /**
     * Handler for touch start events
     * @param {Object} event - Touch event
     */
    onTouchStart(event) {
        // Single touch for rotation
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.input.touch.isDown = true;
            this.input.touch.lastX = touch.x;
            this.input.touch.lastY = touch.y;
            
            // Prevent default to avoid scrolling
            event.event.preventDefault();
        }
    }
    
    /**
     * Handler for touch move events
     * @param {Object} event - Touch event
     */
    onTouchMove(event) {
        // Single touch for rotation
        if (event.touches.length === 1 && this.input.touch.isDown) {
            const touch = event.touches[0];
            
            // Calculate touch movement deltas
            const dx = touch.x - this.input.touch.lastX;
            const dy = touch.y - this.input.touch.lastY;
            this.input.touch.lastX = touch.x;
            this.input.touch.lastY = touch.y;
            
            // Rotate camera based on touch movement
            this.cameraOrbit.yaw += dx * 0.003;
            this.cameraOrbit.pitch -= dy * 0.003;
            
            // Clamp pitch to avoid camera flipping
            this.cameraOrbit.pitch = Math.max(this.cameraOrbit.minPitch, 
                                              Math.min(this.cameraOrbit.pitch, this.cameraOrbit.maxPitch));
            
            // Update camera position
            this.updateCameraTransform();
            
            // Prevent default to avoid scrolling
            event.event.preventDefault();
        }
        
        // Two-finger pinch for zooming
        else if (event.touches.length === 2) {
            // Implementation for pinch zoom would go here
            // This would calculate the distance between two touches
            // and adjust camera distance accordingly
        }
    }
    
    /**
     * Handler for touch end events
     * @param {Object} event - Touch event
     */
    onTouchEnd(event) {
        this.input.touch.isDown = false;
    }
    
    /**
     * Set camera position to focus on a point
     * @param {pc.Vec3} targetPosition - Position to focus on
     * @param {number} distance - Distance from target
     * @param {number} yaw - Horizontal rotation (optional)
     * @param {number} pitch - Vertical rotation (optional)
     */
    focusOn(targetPosition, distance, yaw, pitch) {
        // Set camera target position
        this.cameraOrbit.targetPosition = targetPosition.clone();
        
        // Set distance if provided
        if (distance !== undefined) {
            this.cameraOrbit.distance = Math.max(this.cameraOrbit.minDistance, 
                                              Math.min(distance, this.cameraOrbit.maxDistance));
        }
        
        // Set yaw if provided
        if (yaw !== undefined) {
            this.cameraOrbit.yaw = yaw;
        }
        
        // Set pitch if provided
        if (pitch !== undefined) {
            this.cameraOrbit.pitch = Math.max(this.cameraOrbit.minPitch, 
                                           Math.min(pitch, this.cameraOrbit.maxPitch));
        }
        
        // Update camera position
        this.updateCameraTransform();
    }
    
    /**
     * Set camera position, target and up vector directly
     * @param {Array} position - [x, y, z] position coordinates
     * @param {Array} target - [x, y, z] target/lookAt coordinates
     */
    setCameraPosition(position, target) {
        if (!this.cameraEntity) return;
        
        // Calculate distance between position and target
        const targetVec = new pc.Vec3(target[0], target[1], target[2]);
        const posVec = new pc.Vec3(position[0], position[1], position[2]);
        const distance = posVec.distance(targetVec);
        
        // Update orbit parameters
        this.cameraOrbit.targetPosition = targetVec;
        this.cameraOrbit.distance = distance;
        
        // Set the camera's position and look at target
        this.cameraEntity.setPosition(position[0], position[1], position[2]);
        this.cameraEntity.lookAt(target[0], target[1], target[2]);
    }
    
    /**
     * Clean up event listeners
     */
    cleanup() {
        this.removeEventHandlers();
    }
}