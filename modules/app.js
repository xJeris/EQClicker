let zones = [];       // Array to hold zones and their enemy objects.
let currentZoneIndex = 0;

    // Load enemy data from XML (located in data/enemy.xml)
    function loadEnemyData() {
      fetch('data/enemy.xml')
        .then(response => response.text())
        .then(xmlText => {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xmlText, "application/xml");
          const enemyNodes = xmlDoc.getElementsByTagName("enemy");
          const zoneMap = {};

          // Process each <enemy> element from the XML.
          for (let i = 0; i < enemyNodes.length; i++) {
            const enemyEl = enemyNodes[i];
            const id = parseInt(enemyEl.getAttribute("id"));
            const name = enemyEl.getAttribute("name");
            const zone = parseInt(enemyEl.getAttribute("zone"));
            const baseXP = Number(enemyEl.getAttribute("baseXP"));
            const unlockCost = Number(enemyEl.getAttribute("unlockCost"));
            const baseTime = Number(enemyEl.getAttribute("baseTime"));
            const baseCost = Number(enemyEl.getAttribute("baseCost"));

            // Create an enemy object.
            const enemyObj = {
              id: id,
              name: name,
              zone: zone,
              xpPerClick: baseXP,
              unlockCost: unlockCost,
              automation: {
                purchased: false,
                baseTime: baseTime,
                xpPerCycle: baseXP,  // You may adjust the reward if desired.
                baseCost: baseCost
              },
              xpAccumulated: 0,
              timerProgress: 0,
              interval: null,
              unlocked: false
            };

            // Group enemies according to their zone.
            if (!zoneMap[zone]) {
              zoneMap[zone] = {
                id: zone,
                unlocked: (zone === 1), // Only zone 1 unlocked initially.
                enemies: []
              };
            }
            // Unlock the very first enemy in each zone by default.
            if (zoneMap[zone].enemies.length === 0) {
              enemyObj.unlocked = true;
            }
            zoneMap[zone].enemies.push(enemyObj);
          }

          // Convert the zoneMap to an array and sort by zone id.
          zones = Object.values(zoneMap).sort((a, b) => a.id - b.id);
          zones.forEach(zone => {
            zone.enemies.sort((a, b) => a.id - b.id);
          });

          renderZoneMenu();
          renderZoneContent();
        })
        .catch(error => console.error("Error loading enemy XML data:", error));
    }

    // Render the zones menu in the sidebar.
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

        // Create a container for the enemy details.
        const enemyContent = document.createElement("div");
        enemyContent.className = "enemy-content";

        if (enemy.unlocked) {
          // Create a clickable enemy image (75x75).
          const enemyImg = document.createElement("img");
          enemyImg.className = "enemy-img";
          enemyImg.src = "./img/" + enemy.name + ".png";
          enemyImg.alt = enemy.name;
          enemyImg.addEventListener("click", () => {
            enemy.xpAccumulated += enemy.xpPerClick;
            xpEl.textContent = "XP: " + enemy.xpAccumulated;
            if(autoBtn) { 
              autoBtn.disabled = enemy.xpAccumulated < enemy.automation.baseCost;
            }
            // Unlock next enemy if criteria met.
            if (idx < zone.enemies.length - 1) {
              const nextEnemy = zone.enemies[idx + 1];
              if (!nextEnemy.unlocked && enemy.xpAccumulated >= nextEnemy.unlockCost) {
                nextEnemy.unlocked = true;
                renderZoneContent();
              }
            }
          });
          enemyDiv.appendChild(enemyImg);

          // Create a details container to the right of the image.
          const detailsDiv = document.createElement("div");
          detailsDiv.className = "enemy-details";

          // Top row: enemy name and XP.
          const headerDiv = document.createElement("div");
          headerDiv.className = "enemy-header";
          const nameSpan = document.createElement("span");
          nameSpan.className = "enemy-name";
          nameSpan.textContent = enemy.name;
          headerDiv.appendChild(nameSpan);
          headerDiv.appendChild(document.createElement("br"));
          const xpEl = document.createElement("span");
          xpEl.className = "enemy-xp";
          xpEl.textContent = "XP: " + enemy.xpAccumulated;
          headerDiv.appendChild(xpEl);
          detailsDiv.appendChild(headerDiv);

          // Bottom row: progress bar and automation button.
          const progressRow = document.createElement("div");
          progressRow.className = "progress-row";
          const progressContainer = document.createElement("div");
          progressContainer.className = "progress-container";
          const progressBar = document.createElement("div");
          progressBar.className = "progress-bar";
          if (enemy.automation.purchased) {
            startEnemyAutomation(enemy, xpEl, progressBar);
          } else {
            progressBar.style.width = "0%";
            progressBar.textContent = "Not automated";
          }
          progressContainer.appendChild(progressBar);
          progressRow.appendChild(progressContainer);

          // Only if automation not purchased, add the automation button.
          let autoBtn = null;
          if (!enemy.automation.purchased) {
            autoBtn = document.createElement("button");
            autoBtn.className = "automation-btn";
            autoBtn.textContent = "A";
            autoBtn.disabled = enemy.xpAccumulated < enemy.automation.baseCost;
            autoBtn.addEventListener("click", () => {
              if (enemy.xpAccumulated >= enemy.automation.baseCost) {
                enemy.automation.purchased = true;
                // (Optionally subtract the cost from XP here)
                xpEl.textContent = "XP: " + enemy.xpAccumulated;
                autoBtn.remove();
                startEnemyAutomation(enemy, xpEl, progressBar);
              }
            });
            progressRow.appendChild(autoBtn);
          }

          detailsDiv.appendChild(progressRow);
          enemyContent.appendChild(detailsDiv);
        } else {
          // Locked enemy layout.
          const enemyImg = document.createElement("img");
          enemyImg.className = "enemy-img";
          enemyImg.src = "./img/locked.png";
          enemyImg.alt = enemy.name;
          enemyImg.style.opacity = "0.5";
          enemyDiv.appendChild(enemyImg);

          const detailsDiv = document.createElement("div");
          detailsDiv.className = "enemy-details";
          const headerDiv = document.createElement("div");
          headerDiv.className = "enemy-header";
          const nameSpan = document.createElement("span");
          nameSpan.className = "enemy-name";
          nameSpan.textContent = enemy.name;
          headerDiv.appendChild(nameSpan);
          headerDiv.appendChild(document.createElement("br"));
          const lockedSpan = document.createElement("span");
          lockedSpan.className = "enemy-xp";
          lockedSpan.textContent = "Locked – requires " + enemy.unlockCost + " XP";
          headerDiv.appendChild(lockedSpan);
          detailsDiv.appendChild(headerDiv);

          // If the previous enemy has enough XP, offer an unlock button.
          if (idx > 0) {
            const prevEnemy = zone.enemies[idx - 1];
            if (prevEnemy.xpAccumulated >= enemy.unlockCost) {
              const unlockBtn = document.createElement("button");
              unlockBtn.className = "unlock-btn";
              unlockBtn.textContent = "Unlock";
              unlockBtn.addEventListener("click", () => {
                enemy.unlocked = true;
                renderZoneContent();
              });
              detailsDiv.appendChild(unlockBtn);
            }
          }
          enemyContent.appendChild(detailsDiv);
        }
        enemyDiv.appendChild(enemyContent);
        enemyList.appendChild(enemyDiv);
      });
    }

    // Starts or reattaches an individual enemy’s automation timer.
    function startEnemyAutomation(enemy, xpEl, progressBar) {
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
          xpEl.textContent = "XP: " + enemy.xpAccumulated;
          enemy.timerProgress = 0;
        }
      }, updateInterval);
    }

    document.addEventListener("DOMContentLoaded", loadEnemyData);
