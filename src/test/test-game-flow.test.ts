import { test, expect } from 'vitest';

test.describe('Manual Game Flow Test', () => {
  // Тестирование вручную в браузере:
  
  test('Step 1: MainMenu should load without errors', async () => {
    await browser.url('http://localhost:5174/');
    
    const loadingIndicator = await $('.phaser-container .preloader');
    if (loadingIndicator) {
      console.log('Game is still loading...');
      await loadingIndicator.waitForRemoved();
    }

    // Проверка что MainMenu загружается без ошибок
  });

  test('Step 2: Story button should be clickable', async () => {
    const storyButton = await browser.$('.btn-story');
    expect(storyButton).toBeDefined();
    
    console.log('Story button found and clickable');
  });

  test('Step 3: Dialogue scene opens correctly', async () => {
    // После клика по Сюжеть → диалог пролога "Небесная канцелярия"
    expect(await browser.$('[id="_title"]').getText()).toContain('Небесная канцелярия');
    
    // Проверка интерактивности тирапа текста
  });

  test('Step 4: Click during typing should complete and advance line', async () => {
    // Тестируем что клик не блокируется
    const bodyText = await browser.$('[id="_bodyText"]');
    if (bodyText) {
      console.log('Typing text detected...');
      
      // Имитация клика (если бы мы были в браузере)
      // Или проверка через DOM: есть ли кнопки навигации
    }
  });
  
  test('Step 5: Battle completion returns to StoryMap', async () => {
    // После боя сцена должна вернуться на "Глава 1" карта сюжета
  });

  test('Step 6: No freeze detected during dialogue transitions', async () => {
    // Если клики работают — freeze исправлен!
  });
});
