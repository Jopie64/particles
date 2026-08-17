import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  
  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;
    constructor() {
      this.domElement = document.createElement('canvas');
    }
    setSize = vi.fn();
    getSize = vi.fn().mockReturnValue(new actual.Vector2(1024, 768));
    render = vi.fn();
    dispose = vi.fn();
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});
