/**
 * PetModel3D —— 灵宠真 3D 渲染(three.js + GLTFLoader)。
 * ---------------------------------------------------------------------------
 * 输入:Meshy 生成、存于 IndexedDB 的 glb Blob。
 * 呈现:透明背景画布嵌进舞台灵宠框;模型自动居中缩放;慢速转台 +
 * 指针拖拽旋转;暖光三灯。错误时上抛给舞台回退 2.5D 立绘。
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { clampPetScale } from './petData';
import { loadModel } from './modelLoad';


export function PetModel3D({
  blob,
  scale = 1,
  interactive = true,
  cssScale = 1,
  spin = true
}: {
  blob: Blob;
  scale?: number;
  /** 悬浮卡里传 false：只自动转台，不抢指针（整块是拖拽把手，挪窝优先） */
  interactive?: boolean;
  /** 自动转台开关（设置里的「3D 自动旋转」）；关掉后模型静止，舞台页仍可拖着转 */
  spin?: boolean;
  /** 外层 CSS 缩放倍数：只用来提高渲染分辨率，放大时不糊（不触发重建） */
  cssScale?: number;
}): React.ReactElement {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<{ setPixelRatio(r: number): void; setSize(w: number, h: number, updateStyle?: boolean): void } | null>(null);
  const cssScaleRef = useRef(cssScale);
  cssScaleRef.current = cssScale;
  const spinRef = useRef(spin);
  spinRef.current = spin;
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  /* 外部倍率变了：只改像素比 + 尺寸，不重建场景 */
  useEffect(() => {
    const r = rendererRef.current;
    const host = hostRef.current;
    if (!r || !host) return;
    r.setPixelRatio(Math.min((window.devicePixelRatio || 1) * Math.max(1, cssScale), 3));
    r.setSize(host.clientWidth || 240, host.clientHeight || 240, false);
  }, [cssScale]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let raf = 0;
    let disposed = false;
    let cleanupFns: Array<() => void> = [];
    setLoading(true);
    setErr(false);

    (async () => {
      try {
        const THREE = await import('three');
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(
          Math.min((window.devicePixelRatio || 1) * Math.max(1, cssScaleRef.current), 3)
        );
        rendererRef.current = renderer;
        renderer.setSize(host.clientWidth || 240, host.clientHeight || 240);
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.touchAction = 'none';
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
        camera.position.set(0, 0.7, 4.4);
        camera.lookAt(0, 0, 0);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7bd, 1.15));
        const key = new THREE.DirectionalLight(0xfff2df, 2.0);
        key.position.set(2.2, 3.2, 2.6);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xdfeaff, 0.7);
        rim.position.set(-2.4, 1.2, -2.2);
        scene.add(rim);

        const group = new THREE.Group();
        scene.add(group);

        const model = (await loadModel(THREE, blob)) as any;
        if (disposed) return;

        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new (THREE as any).Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        model.scale.setScalar((2.3 / maxDim) * clampPetScale(scale));
        const box2 = new THREE.Box3().setFromObject(model);
        const center = box2.getCenter(new (THREE as any).Vector3());
        model.position.sub(center);
        group.add(model);

        /* 拖拽旋转 */
        let dragging = false;
        let lastX = 0;
        const SPIN = 0.004;
        let vel = spinRef.current ? SPIN : 0;
        /* 拖过之后先停 1.5 秒再恢复自动转：用户刚摆好的角度不会立刻被转走 */
        let resumeAt = 0;
        const onDown = (e: PointerEvent) => {
          dragging = true;
          lastX = e.clientX;
          renderer.domElement.setPointerCapture(e.pointerId);
        };
        const onMove = (e: PointerEvent) => {
          if (!dragging) return;
          const dx = e.clientX - lastX;
          lastX = e.clientX;
          group.rotation.y += dx * 0.012;
          vel = 0;
          resumeAt = performance.now() + 1500;
        };
        const onUp = (e: PointerEvent) => {
          dragging = false;
          resumeAt = performance.now() + 1500;
          try {
            renderer.domElement.releasePointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
        };
        const dom = renderer.domElement;
        if (interactive) {
          dom.addEventListener('pointerdown', onDown);
          dom.addEventListener('pointermove', onMove);
          dom.addEventListener('pointerup', onUp);
          dom.addEventListener('pointercancel', onUp);
        } else {
          /* 非交互：指针穿透到父级 —— 轻叩照常落在灵宠按钮上，拖拽照常挪窝 */
          dom.style.pointerEvents = 'none';
        }

        const onResize = () => {
          const w = host.clientWidth || 240;
          const h = host.clientHeight || 240;
          renderer.setSize(w, h, false);
          camera.aspect = w / Math.max(1, h);
          camera.updateProjectionMatrix();
        };
        window.addEventListener('resize', onResize);

        const tick = () => {
          if (disposed) return;
          if (!dragging) {
            if (spinRef.current) {
              if (!vel && performance.now() > resumeAt) vel = SPIN;
              group.rotation.y += vel;
            } else {
              vel = 0;
            }
          }
          renderer.render(scene, camera);
          raf = requestAnimationFrame(tick);
        };
        tick();

        cleanupFns = [
          () => {
            dom.removeEventListener('pointerdown', onDown);
            dom.removeEventListener('pointermove', onMove);
            dom.removeEventListener('pointerup', onUp);
            dom.removeEventListener('pointercancel', onUp);
            window.removeEventListener('resize', onResize);
          },
          () => {
            model.traverse((o: any) => {
              if (o.geometry) o.geometry.dispose();
              const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
              mats.forEach((mt: any) => {
                for (const k of Object.keys(mt)) {
                  const v = mt[k];
                  if (v && v.isTexture) v.dispose();
                }
                mt.dispose();
              });
            });
            renderer.dispose();
            dom.remove();
          }
        ];
        setLoading(false);
      } catch (loadErr) {
        console.error('[dsh-pet-lingchong] 3D 加载失败:', loadErr);
        if (!disposed) {
          setErr(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanupFns.forEach((fn) => fn());
      rendererRef.current = null;
    };
  }, [blob, interactive]);

  return (
    <div ref={hostRef} className="absolute inset-0 z-10">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="liquid-glass flex items-center gap-2 px-4 py-2 rounded-full">
            <Loader2 className="w-4 h-4 text-pet-charcoal animate-spin" />
            <span className="text-xs font-bold text-pet-charcoal">3D 模型加载中…</span>
          </div>
        </div>
      )}
      {err && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <span className="text-[11px] text-pet-muted">3D 模型加载失败,已回退立绘</span>
        </div>
      )}
    </div>
  );
}