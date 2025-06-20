    let zones = [];       // To hold zones and their enemies after XML parsing
    let currentZoneIndex = 0;

    // Load enemy data from the XML file.
    function loadEnemyData() {
      fetch('data/enemy.xml')
        .then(response => response.text())
        .then(xmlText => {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "text/xml");
          const enemyNodes = xmlDoc.getElementsByTagName("enemy");
          const zoneMap = {};

          // Process each <enemy> node from enemy.xml.
          for (let i = 0; i < enemyNodes.length; i++) {
            const enemyEl = enemyNodes[i];
            const id = parseInt(enemyEl.getAttribute("id"));
            const name = enemyEl.getAttribute("name");
            const zone = parseInt(enemyEl.getAttribute("zone"));
            const baseXP = Number(enemyEl.getAttribute("baseXP"));
            const unlockCost = Number(enemyEl.getAttribute("unlockCost"));
            const baseTime = Number(enemyEl.getAttribute("baseTime"));
            const baseCost = Number(enemyEl.getAttribute("baseCost"));

            // Create an enemy object with its own properties.
            const enemyObj = {
              id: id,
              name: name,
              zone: zone,
              xpPerClick: baseXP,
              unlockCost: unlockCost,
              automation: {
                purchased: false,
                baseTime: baseTime,
                xpPerCycle: baseXP,  // You can adjust the automation XP reward if desired.
                baseCost: baseCost
              },
              xpAccumulated: 0,
              timerProgress: 0,
              interval: null,
              unlocked: false
            };

            // Group enemies by zone.
            if (!zoneMap[zone]) {
              zoneMap[zone] = {
                id: zone,
                unlocked: (zone === 1), // Only zone 1 is unlocked by default.
                enemies: []
              };
            }
            // Unlock the very first enemy in each zone by default.
            if (zoneMap[zone].enemies.length === 0) {
              enemyObj.unlocked = true;
            }
            zoneMap[zone].enemies.push(enemyObj);
          }

          // Transform the zoneMap into a sorted array and sort each zone’s enemies by id.
          zones = Object.values(zoneMap).sort((a, b) => a.id - b.id);
          zones.forEach(zone => {
            zone.enemies.sort((a, b) => a.id - b.id);
          });

          renderZoneMenu();
          renderZoneContent();
        })
        .catch(error => console.error("Error loading enemy XML data:", error));
    }

    // Render the vertical zone menu.
    function renderZoneMenu() {
      const menu = document.getElementById("zone-menu");
      menu.innerHTML = "";
      zones.forEach((zone, idx) => {
        const li = document.createElement("li");
        li.textContent = "Zone " + zone.id + (zone.unlocked ? "" : " (Locked)");
        li.dataset.zoneIndex = idx;
        li.addEventListener("click", () => {
          currentZoneIndex = idx;
          renderZoneContent();
        });
        menu.appendChild(li);
      });
    }

    // Render the enemy list for the current zone.
    function renderZoneContent() {
      const zone = zones[currentZoneIndex];
      document.getElementById("zone-title").textContent = "Zone " + zone.id;
      const enemyList = document.getElementById("enemy-list");
      enemyList.innerHTML = "";

      zone.enemies.forEach((enemy, idx) => {
        const enemyDiv = document.createElement("div");
        enemyDiv.className = "enemy";

        // Create an XP display element.
        const xpDisplay = document.createElement("div");
        xpDisplay.className = "xp-display";
        xpDisplay.textContent = "XP: " + enemy.xpAccumulated;
        enemyDiv.appendChild(xpDisplay);

        // Container for interactions related to the enemy.
        const enemyContent = document.createElement("div");
        enemyContent.className = "enemy-content";

        if (enemy.unlocked) {
          // Manual attack button that adds XP per click.
          const clickBtn = document.createElement("button");
          clickBtn.textContent = enemy.name + " (Click to attack)";
          clickBtn.addEventListener("click", () => {
            enemy.xpAccumulated += enemy.xpPerClick;
            xpDisplay.textContent = "XP: " + enemy.xpAccumulated;
            // If the buy automation button exists for this enemy, update its enabled state.
            if (autoBtn) {
              autoBtn.disabled = enemy.xpAccumulated < enemy.automation.baseCost;
            }
            // Check if the next enemy should now be unlocked.
            if (idx < zone.enemies.length - 1) {
              const nextEnemy = zone.enemies[idx + 1];
              if (!nextEnemy.unlocked && enemy.xpAccumulated >= nextEnemy.unlockCost) {
                nextEnemy.unlocked = true;
                renderZoneContent();
              }
            }
          });
          enemyContent.appendChild(clickBtn);

          // Create a progress bar container.
          const progressContainer = document.createElement("div");
          progressContainer.className = "progress-container";
          const progressBar = document.createElement("div");
          progressBar.className = "progress-bar";

          // Each enemy has its own automation purchase button.
          let autoBtn = null;
          if (!enemy.automation.purchased) {
            autoBtn = document.createElement("button");
            autoBtn.textContent = "Buy Automation (Cost: " + enemy.automation.baseCost + ")";
            autoBtn.disabled = enemy.xpAccumulated < enemy.automation.baseCost;
            autoBtn.addEventListener("click", () => {
              if (enemy.xpAccumulated >= enemy.automation.baseCost) {
                // Mark only this enemy's automation as purchased.
                enemy.automation.purchased = true;
                // Optionally subtract the automation cost:
                // enemy.xpAccumulated -= enemy.automation.baseCost;
                xpDisplay.textContent = "XP: " + enemy.xpAccumulated;
                // Remove this enemy's automation button.
                autoBtn.remove();
                // Start the automation timer for this enemy.
                startEnemyAutomation(enemy, xpDisplay, progressBar);
              }
            });
            enemyContent.appendChild(autoBtn);
          }

          // If automation is purchased, reattach (or start) the automation timer.
          if (enemy.automation.purchased) {
            startEnemyAutomation(enemy, xpDisplay, progressBar);
          } else {
            progressBar.style.width = "0%";
            progressBar.textContent = "Not automated";
          }
          progressContainer.appendChild(progressBar);
          enemyContent.appendChild(progressContainer);
        } else {
          // UI for locked enemy: show enemy info and potential unlock button.
          enemyContent.textContent =
            enemy.name + " (Locked – requires " + enemy.unlockCost + " XP from previous enemy)";
          if (idx > 0) {
            const prevEnemy = zone.enemies[idx - 1];
            if (prevEnemy.xpAccumulated >= enemy.unlockCost) {
              const unlockBtn = document.createElement("button");
              unlockBtn.textContent = "Unlock";
              unlockBtn.addEventListener("click", () => {
                enemy.unlocked = true;
                renderZoneContent();
              });
              enemyContent.appendChild(unlockBtn);
            }
          }
        }
        enemyDiv.appendChild(enemyContent);
        enemyList.appendChild(enemyDiv);
      });
    }

    // Starts (or reattaches) the automation timer for a specific enemy.
    function startEnemyAutomation(enemy, xpDisplay, progressBar) {
      // Clear any existing interval to avoid duplicates.
      if (enemy.interval) {
        clearInterval(enemy.interval);
      }
      const updateInterval = 100; // milliseconds
      enemy.interval = setInterval(() => {
        enemy.timerProgress += updateInterval;
        const progressPercent = Math.min(enemy.timerProgress / enemy.automation.baseTime, 1) * 100;
        progressBar.style.width = progressPercent + "%";
        const xpPerSec = (enemy.automation.xpPerCycle * 1000 / enemy.automation.baseTime).toFixed(2);
        progressBar.textContent = xpPerSec + " XP/s";
        if (enemy.timerProgress >= enemy.automation.baseTime) {
          enemy.xpAccumulated += enemy.automation.xpPerCycle;
          xpDisplay.textContent = "XP: " + enemy.xpAccumulated;
          enemy.timerProgress = 0;
        }
      }, updateInterval);
    }

    // When the DOM is ready, load enemy data from XML.
    document.addEventListener("DOMContentLoaded", loadEnemyData);
    