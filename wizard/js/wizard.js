// Digital Twin Visualization Selector - Logic

// Path tracking
let path = [];

// Show step by ID
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
    });
    document.getElementById(stepId).classList.add('active');
}

// Add to decision path
function addToPath(question, answer) {
    path.push({ question, answer });
    updatePathDisplay();
}

// Update path display
function updatePathDisplay() {
    const pathDisplay = document.getElementById('pathDisplay');
    if (path.length === 0) {
        pathDisplay.innerHTML = '';
        return;
    }
    
    let html = '';
    path.forEach(item => {
        html += `
            <div class="path-item">
                <div class="path-question">${item.question}</div>
                <div class="path-answer">${item.answer}</div>
            </div>
        `;
    });
    pathDisplay.innerHTML = html;
}

// Show result
function showResult(result) {
    document.getElementById('resultText').textContent = `Recommended Visualization: ${result}`;
    addToPath('Recommendation', result);
    showStep('resultContainer');
}

// Restart wizard
function restart() {
    path = [];
    updatePathDisplay();
    showStep('step1');
}

// Domain selection handler
function selectDomain(domain, displayName) {
    path = []; // Reset path when starting a new selection
    addToPath('Application Type', displayName);
    
    // Show relevant follow-up question based on domain
    const container = document.getElementById('questionContainer');
    
    switch (domain) {
        case 'industrial':
            container.innerHTML = `
                <div class="question">Is high fidelity & real-time visualization essential?</div>
                <div class="options">
                    <button class="option-btn" onclick="industrialPath(true)">Yes</button>
                    <button class="option-btn" onclick="industrialPath(false)">No</button>
                </div>
            `;
            break;
            
        case 'urban':
            container.innerHTML = `
                <div class="question">Is detailed building lifecycle management required?</div>
                <div class="options">
                    <button class="option-btn" onclick="showResult('Building Information Modeling (BIM)')">Yes</button>
                    <button class="option-btn" onclick="urbanPath1()">No</button>
                </div>
            `;
            break;
            
        case 'healthcare':
            container.innerHTML = `
                <div class="question">Is precision and realism critical?</div>
                <div class="options">
                    <button class="option-btn" onclick="healthcarePath(true)">Yes</button>
                    <button class="option-btn" onclick="healthcarePath(false)">No</button>
                </div>
            `;
            break;
            
        case 'environment':
            container.innerHTML = `
                <div class="question">Is real-time visualization important?</div>
                <div class="options">
                    <button class="option-btn" onclick="environmentPath(true)">Yes</button>
                    <button class="option-btn" onclick="environmentPath(false)">No</button>
                </div>
            `;
            break;
            
        case 'education':
            container.innerHTML = `
                <div class="question">Are immersive training experiences required?</div>
                <div class="options">
                    <button class="option-btn" onclick="educationPath(true)">Yes</button>
                    <button class="option-btn" onclick="educationPath(false)">No</button>
                </div>
            `;
            break;
            
        case 'general':
            container.innerHTML = `
                <div class="question">Is cross-platform accessibility required?</div>
                <div class="options">
                    <button class="option-btn" onclick="showResult('Web-based Visualization')">Yes</button>
                    <button class="option-btn" onclick="generalPath1()">No</button>
                </div>
            `;
            break;
    }
    
    showStep('questionContainer');
}

// Industrial path
function industrialPath(isHighFidelity) {
    addToPath('High fidelity & real-time visualization essential?', isHighFidelity ? 'Yes' : 'No');
    
    const container = document.getElementById('questionContainer');
    
    if (isHighFidelity) {
        container.innerHTML = `
            <div class="question">Is extremely high rendering performance critical?</div>
            <div class="options">
                <button class="option-btn" onclick="industrialPath2(true)">Yes</button>
                <button class="option-btn" onclick="industrialPath2(false)">No</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="question">Is highly interactive visualization required?</div>
            <div class="options">
                <button class="option-btn" onclick="industrialPath3(true)">Yes</button>
                <button class="option-btn" onclick="industrialPath3(false)">No</button>
            </div>
        `;
    }
}

function industrialPath2(isHighPerformance) {
    addToPath('Extremely high rendering performance critical?', isHighPerformance ? 'Yes' : 'No');
    
    const container = document.getElementById('questionContainer');
    
    if (isHighPerformance) {
        container.innerHTML = `
            <div class="question">Are there significant hardware cost constraints?</div>
            <div class="options">
                <button class="option-btn" onclick="showResult('Neural Rendering')">Yes</button>
                <button class="option-btn" onclick="showResult('GPU-Optimized Rendering')">No</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="question">Are there significant hardware cost constraints?</div>
            <div class="options">
                <button class="option-btn" onclick="showResult('Virtual Reality (VR)')">Yes</button>
                <button class="option-btn" onclick="showResult('GPU-Optimized Rendering')">No</button>
            </div>
        `;
    }
}

function industrialPath3(isInteractive) {
    addToPath('Highly interactive visualization required?', isInteractive ? 'Yes' : 'No');
    
    const container = document.getElementById('questionContainer');
    
    if (isInteractive) {
        container.innerHTML = `
            <div class="question">Are there significant hardware or budget constraints?</div>
            <div class="options">
                <button class="option-btn" onclick="showResult('Web-based Visualization')">Yes</button>
                <button class="option-btn" onclick="showResult('Augmented Reality (AR) or Virtual Reality (VR)')">No</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="question">Is detailed lifecycle/component management needed?</div>
            <div class="options">
                <button class="option-btn" onclick="showResult('Building Information Modeling (BIM)')">Yes</button>
                <button class="option-btn" onclick="showResult('Computer-Aided Design (CAD)')">No</button>
            </div>
        `;
    }
}

// Urban planning paths
function urbanPath1() {
    addToPath('Detailed building lifecycle management required?', 'No');
    
    const container = document.getElementById('questionContainer');
    container.innerHTML = `
        <div class="question">Is high real-world accuracy critical?</div>
        <div class="options">
            <button class="option-btn" onclick="showResult('Point Cloud Visualization')">Yes</button>
            <button class="option-btn" onclick="urbanPath2()">No</button>
        </div>
    `;
}

function urbanPath2() {
    addToPath('High real-world accuracy critical?', 'No');
    
    const container = document.getElementById('questionContainer');
    container.innerHTML = `
        <div class="question">Are highly interactive presentations required?</div>
        <div class="options">
            <button class="option-btn" onclick="urbanPath3()">Yes</button>
            <button class="option-btn" onclick="showResult('Computer-Aided Design (CAD)')">No</button>
        </div>
    `;
}

function urbanPath3() {
    addToPath('Highly interactive presentations required?', 'Yes');
    
    const container = document.getElementById('questionContainer');
    container.innerHTML = `
        <div class="question">Are there significant hardware constraints?</div>
        <div class="options">
            <button class="option-btn" onclick="showResult('Web-based Visualization')">Yes</button>
            <button class="option-btn" onclick="showResult('Augmented Reality (AR) or Virtual Reality (VR)')">No</button>
        </div>
    `;
}

// Healthcare paths
function healthcarePath(isPrecisionCritical) {
    addToPath('Precision and realism critical?', isPrecisionCritical ? 'Yes' : 'No');
    
    const container = document.getElementById('questionContainer');
    
    if (isPrecisionCritical) {
        container.innerHTML = `
            <div class="question">Is extremely high rendering performance critical?</div>
            <div class="options">
                <button class="option-btn" onclick="healthcarePath2(true)">Yes</button>
                <button class="option-btn" onclick="showResult('Neural Rendering')">No</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="question">Are interactive training scenarios required?</div>
            <div class="options">
                <button class="option-btn" onclick="healthcarePath3()">Yes</button>
                <button class="option-btn" onclick="showResult('Web-based Visualization')">No</button>
            </div>
        `;
    }
}

function healthcarePath2(isHighPerformance) {
    addToPath('Extremely high rendering performance critical?', 'Yes');
    
    const container = document.getElementById('questionContainer');
    container.innerHTML = `
        <div class="question">Are there significant hardware constraints?</div>
        <div class="options">
            <button class="option-btn" onclick="showResult('Neural Rendering')">Yes</button>
            <button class="option-btn" onclick="showResult('GPU-Optimized Rendering')">No</button>
        </div>
    `;
}

function healthcarePath3() {
    addToPath('Interactive training scenarios required?', 'Yes');
    
    const container = document.getElementById('questionContainer');
    container.innerHTML = `
        <div class="question">Are there significant hardware constraints?</div>
        <div class="options">
            <button class="option-btn" onclick="showResult('Augmented Reality (AR)')">Yes</button>
            <button class="option-btn" onclick="showResult('Virtual Reality (VR)')">No</button>
        </div>
    `;
}

// Environmental paths
function environmentPath(isRealTime) {
    addToPath('Real-time visualization important?', isRealTime ? 'Yes' : 'No');
    
    const container = document.getElementById('questionContainer');
    
    if (isRealTime) {
        container.innerHTML = `
            <div class="question">Is large spatial coverage area required?</div>
            <div class="options">
                <button class="option-btn" onclick="showResult('Web-based Visualization')">Yes</button>
                <button class="option-btn" onclick="showResult('Augmented Reality (AR) or Point Cloud Visualization')">No</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="question">Is large spatial coverage area required?</div>
            <div class="options">
                <button class="option-btn" onclick="showResult('Building Information Modeling (BIM) or Web-based Visualization')">Yes</button>
                <button class="option-btn" onclick="showResult('Computer-Aided Design (CAD) or Point Cloud Visualization')">No</button>
            </div>
        `;
    }
}

// Education paths
function educationPath(isImmersive) {
    addToPath('Immersive training experiences required?', isImmersive ? 'Yes' : 'No');
    
    const container = document.getElementById('questionContainer');
    
    if (isImmersive) {
        container.innerHTML = `
            <div class="question">Are there significant hardware or budget constraints?</div>
            <div class="options">
                <button class="option-btn" onclick="showResult('Augmented Reality (AR)')">Yes</button>
                <button class="option-btn" onclick="showResult('Virtual Reality (VR)')">No</button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="question">Is highly interactive visualization still needed?</div>
            <div class="options">
                <button class="option-btn" onclick="showResult('Web-based Visualization')">Yes</button>
                <button class="option-btn" onclick="showResult('Computer-Aided Design (CAD) or Building Information Modeling (BIM)')">No</button>
            </div>
        `;
    }
}

// General paths
function generalPath1() {
    addToPath('Cross-platform accessibility required?', 'No');
    
    const container = document.getElementById('questionContainer');
    container.innerHTML = `
        <div class="question">Is high rendering performance critical?</div>
        <div class="options">
            <button class="option-btn" onclick="showResult('GPU-Optimized Rendering')">Yes</button>
            <button class="option-btn" onclick="generalPath2()">No</button>
        </div>
    `;
}

function generalPath2() {
    addToPath('High rendering performance critical?', 'No');
    
    const container = document.getElementById('questionContainer');
    container.innerHTML = `
        <div class="question">Are highly interactive experiences required?</div>
        <div class="options">
            <button class="option-btn" onclick="showResult('Virtual Reality (VR) or Augmented Reality (AR)')">Yes</button>
            <button class="option-btn" onclick="showResult('Computer-Aided Design (CAD) or Neural Rendering')">No</button>
        </div>
    `;
}