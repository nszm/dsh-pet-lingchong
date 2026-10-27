/**
 * 3D 模型加载 / 缩略图渲染（不含 React，舞台与导入流程共用）。
 * ---------------------------------------------------------------------------
 * · loadModel —— 按 Blob.type 选 loader（口径见 modelFormats.tagModelBlob）
 * · renderModelThumb —— 导入后立刻离线渲一张 512px PNG 当图鉴封面
 *   （以前 GLB 灵宠在图鉴里只有一个「3D」渐变占位块，看不出导入的是什么）
 */
import type * as ThreeNS from 'three';

type Three = typeof ThreeNS;

/**
 * 按 Blob.type 选 loader —— 落库时 modelFormats.tagModelBlob 已经把 MIME 统一成
 * model/gltf-binary（GLB / VRM）、model/stl、model/obj、model/ply 四种。
 * STL / PLY 只有几何：给中性材质；OBJ 没有 MTL：统一换成标准材质（否则是一片死灰 Phong）。
 */
export async function loadModel(THREE: Three, blob: Blob): Promise<ThreeNS.Object3D> {
  const type = blob.type || '';
  if (type === 'model/stl') {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
    const geo = new STLLoader().parse(await blob.arrayBuffer());
    geo.computeVertexNormals();
    return new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0xd9cfc2, roughness: 0.62, metalness: 0.08 })
    );
  }
  if (type === 'model/ply') {
    const { PLYLoader } = await import('three/examples/jsm/loaders/PLYLoader.js');
    const geo = new PLYLoader().parse(await blob.arrayBuffer());
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const hasColor = !!geo.attributes.color;
    return new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        vertexColors: hasColor,
        color: hasColor ? 0xffffff : 0xd9cfc2,
        roughness: 0.62,
        metalness: 0.08
      })
    );
  }
  if (type === 'model/obj') {
    const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
    const obj = new OBJLoader().parse(await blob.text());
    const mat = new THREE.MeshStandardMaterial({ color: 0xcfc6ba, roughness: 0.68, metalness: 0.06 });
    obj.traverse((o: any) => {
      if (o.isMesh) o.material = mat;
    });
    return obj;
  }
  // glb / vrm / 没标 type 的老数据
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const buf = await blob.arrayBuffer();
  const gltf = await new Promise<any>((resolve, reject) => {
    new GLTFLoader().parse(buf, '', resolve, reject);
  });
  return gltf.scene as ThreeNS.Object3D;
}

/** 离屏渲一张透明底方图（导入时当图鉴封面用）；失败返回 null，让调用方回退占位图 */
export async function renderModelThumb(blob: Blob, size = 512): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  let renderer: ThreeNS.WebGLRenderer | null = null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  try {
    const THREE = (await import('three')) as Three;
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      // 渲染完要立刻 toBlob，缓冲得留着
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7bd, 1.3));
    const key = new THREE.DirectionalLight(0xfff2df, 2.1);
    key.position.set(2.2, 3.2, 2.6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfeaff, 0.85);
    rim.position.set(-2.4, 1.2, -2.2);
    scene.add(rim);

    const model = await loadModel(THREE, blob);
    const box = new THREE.Box3().setFromObject(model);
    const dim = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(dim.x, dim.y, dim.z) || 1;
    model.scale.setScalar(2.4 / maxDim);
    const box2 = new THREE.Box3().setFromObject(model);
    const center = box2.getCenter(new THREE.Vector3());
    model.position.sub(center);

    const group = new THREE.Group();
    group.add(model);
    group.rotation.y = -0.38; // 3/4 侧面比正对好看
    scene.add(group);

    camera.position.set(0.55, 0.85, 5.1);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);

    const png = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/png'));

    model.traverse((o: any) => {
      o.geometry?.dispose?.();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x: any) => x?.dispose?.());
      else m?.dispose?.();
    });
    return png;
  } catch {
    return null;
  } finally {
    try {
      renderer?.dispose();
      renderer?.forceContextLoss?.();
    } catch {
      /* noop */
    }
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** 把一张图缩成方形小图（图鉴列表用 256） */
export async function shrinkImage(src: Blob, size = 256): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(src);
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    if (!g) return null;
    g.drawImage(bmp, 0, 0, size, size);
    bmp.close?.();
    return await new Promise<Blob | null>((res) =>
      c.toBlob((b) => res(b), 'image/webp', 0.9)
    );
  } catch {
    return null;
  }
}
