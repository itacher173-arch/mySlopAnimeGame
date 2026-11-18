import puppeteer from 'puppeteer-core';
import Phaser from 'phaser';

let serverUrl = process.env.TEST_SERVER || 'http://localhost:5174';
let gameInstance: Phaser.Game | null = null;

async function main() {
  console.log(`Opening browser at http://${serverUrl}/`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl'],
  });
  const page = browser.pages()[0];

  try {
    // Открываем игру
    console.log('Loading game at /');
    await page.goto(serverUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Ждём загрузки сцены Boot
    console.log('Waiting for Boot scene to finish...');
    await page.waitForSelector('#app > div.phaser-container', { timeout: 15000 });

    // Ждём когда появится заголовок пролога или меню
    console.log('Waitint for game to init dialog or menu...');
    const dialogContent = await page.evaluate(() => {
      // Ищем текст из диалога или кнопки меню
      const elements: NodeListOf<HTMLElement> = document.querySelectorAll('div[id="app"] > div[role="img"]');
      return Array.from(elements).map(el => el.textContent);
    });

    console.log('Game loaded, checking for dialogue:', dialogContent);

    // Проверяем, запущена ли сцена BootDialogue (пролог) или MainMenu
    const scene = await page.evaluate(() => {
      // Идентификация сцены по наличию элементов интерфейса
      const bootElements = document.querySelectorAll('.phaser-container > div[id^="boot_"]');
      return bootElements.length > 0 ? 'Boot' : 
             document.querySelector('button:contains("Новая игра")') ? 'MainMenu' : 
             'Unknown';
    });

    console.log(`Detected scene: ${scene}`);

    if (scene === 'Boot') {
      console.log('📖 Dialogue scene detected - testing interaction flow...');
      
      // Ждём загрузки сцены boot_dialogue
      await page.waitForTimeout(3000);

      const currentText = await page.evaluate(() => {
        const textContainers = document.querySelectorAll('.phaser-container > div[id^="boot_"] > div[id$="_bodyText"]');
        return Array.from(textContainers).map(el => el.textContent);
      });

      console.log('Current dialogue text:', currentText);

    } else if (scene === 'MainMenu' || scene === 'Unknown') {
      console.log('⚠️ Not in boot dialogue - checking game state...');
      
      // Проверка на заморозку — ждём 10 секунд и проверяем DOM
      await page.waitForTimeout(10000);
      
      try {
        const frozen = await page.evaluate(() => {
          // Если диалог висящий — текст не меняется последние 5 сек (через timestamp)
          const bootDivs = document.querySelectorAll('.phaser-container > div[id^="boot_"]');
          if (bootDivs.length === 0) return false;
          
          const lastInputTime = Date.now();
          // Проверяем наличие кнопки "Пропустить" или заголовка
          const hasInteractButtons = document.querySelector('button');
          return !hasInteractButtons;
        });

        if (frozen) {
          console.log('❌ Game appears frozen - no interactable elements found');
        } else {
          console.log('✅ Game has interaction buttons available');
        }
      } catch (err) {
        console.error('Error during freeze check:', err);
      }

    } else {
      console.log('🎮 Running in Battle/StoryMap scene...');
      
      // Если игра в бое или карте сюжета — проверяем переход
      await page.waitForTimeout(5000);
      console.log('Test completed - check game manually for flow issues');
    }

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
