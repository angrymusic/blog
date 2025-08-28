---
layout: doc
date: 2025-08-28
title: mini-vue 코드
description: reactive-core.ts, mini-vue.ts, main.ts
---

# 코드

https://github.com/angrymusic/mini-vue

## reactive-core.ts

```ts {1}
// reactive-core.ts
export const REF_BRAND: unique symbol = Symbol("refBrand");

export type Ref<T> = { value: T; [REF_BRAND]?: true };
export type ComputedRef<T> = Readonly<Ref<T>>;
export type UnwrapRef<T> = T extends Ref<infer V> ? V : T;
export type ShallowUnwrapRefs<T extends object> = {
  [K in keyof T]: UnwrapRef<T[K]>;
};

// --- Effect / Dep graph ---

type EffectFn = (() => any) & {
  deps?: Array<Set<EffectFn>>;
  active?: boolean;
  scheduler?: () => void;
};

let activeEffect: EffectFn | null = null;
const effectStack: EffectFn[] = [];
const targetMap = new WeakMap<object, Map<PropertyKey, Set<EffectFn>>>();

// 값을 읽을 때
function track(target: object, key: PropertyKey) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));
  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    (activeEffect.deps ||= []).push(dep);
  }
}

// 값을 쓸 때
function trigger(target: object, key: PropertyKey) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (!dep) return;
  const effects = new Set(dep);
  for (const e of effects) {
    if (e === activeEffect) continue;
    e.scheduler ? e.scheduler() : queueJob(e);
  }
}

// effect가 다시 실행되기 전에 기존에 등록된 의존성을 정리
function cleanup(effect: EffectFn) {
  const deps = effect.deps;
  if (!deps) return;
  for (const dep of deps) dep.delete(effect);
  deps.length = 0;
}

//
export function effect(
  fn: () => any,
  options?: { scheduler?: () => void; lazy?: boolean }
) {
  const runner: EffectFn = function () {
    cleanup(runner);
    try {
      activeEffect = runner;
      effectStack.push(runner);
      return fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1] || null;
    }
  };

  runner.active = true;
  runner.scheduler = options?.scheduler;
  if (!options?.lazy) runner();
  return runner;
}

// --- 마이크로태스크 배치 ---

const jobQueue = new Set<() => any>();
let isFlushing = false;

function queueJob(job: () => any) {
  jobQueue.add(job);
  if (!isFlushing) {
    isFlushing = true;
    Promise.resolve().then(flushJobs);
  }
}

function flushJobs() {
  try {
    for (const job of jobQueue) job();
  } finally {
    jobQueue.clear();
    isFlushing = false;
  }
}

// --- reactive ---

const reactiveCache = new WeakMap<object, any>();

export function reactive<T extends object>(target: T): T {
  if (reactiveCache.has(target)) return reactiveCache.get(target);
  const proxy = new Proxy(target, {
    get(t, key, recv) {
      const res = Reflect.get(t, key, recv);
      track(t, key);
      return isObject(res) ? reactive(res) : res;
    },
    set(t, key, val, recv) {
      const oldVal = (t as any)[key];
      const ok = Reflect.set(t, key, val, recv);
      if (ok && !Object.is(oldVal, val)) trigger(t, key);
      return ok;
    },
  });
  reactiveCache.set(target, proxy);
  return proxy;
}

function isObject(val: unknown): val is object {
  return val !== null && typeof val === "object";
}

// --- ref ---

class RefImpl<T> implements Ref<T> {
  [REF_BRAND] = true as const;
  private _value: T;
  public dep?: Set<EffectFn>;
  constructor(v: T) {
    this._value = v;
  }
  get value(): T {
    trackRefValue(this);
    return this._value;
  }
  set value(next: T) {
    if (!Object.is(this._value, next)) {
      this._value = next;
      triggerRefValue(this);
    }
  }
}

function trackRefValue(ref: RefImpl<any>) {
  if (!activeEffect) return;
  (ref.dep ||= new Set()).add(activeEffect);
  (activeEffect.deps ||= []).push(ref.dep);
}

function triggerRefValue(ref: RefImpl<any>) {
  const dep = ref.dep;
  if (!dep) return;
  const effects = new Set(dep);
  for (const e of effects) e.scheduler ? e.scheduler() : queueJob(e);
}

export function ref<T>(v: T): Ref<T> {
  return new RefImpl<T>(v);
}

export function isRef(r: unknown): r is Ref<unknown> {
  return typeof r === "object" && r !== null && REF_BRAND in (r as any);
}

export function unref<T>(r: T | Ref<T>): T {
  return isRef(r) ? (r as any).value : (r as any);
}

export function proxyRefs<T extends object>(obj: T): ShallowUnwrapRefs<T> {
  return new Proxy(obj as any, {
    get(t, k, rcv) {
      return unref(Reflect.get(t, k, rcv));
    },
    set(t, k, v, rcv) {
      const old = Reflect.get(t, k, rcv);
      if (isRef(old) && !isRef(v)) {
        (old as any).value = v;
        return true;
      }
      return Reflect.set(t, k, v, rcv);
    },
  }) as any;
}

// --- computed ---

export function computed<T>(getter: () => T): ComputedRef<T> {
  let cached!: T;
  let dirty = true;
  const holder: any = {};
  (holder as any)[REF_BRAND] = true; // ref 브랜드 → proxyRefs/unref 대상

  const runner = effect(getter, {
    lazy: true,
    scheduler: () => {
      if (!dirty) {
        dirty = true;
        trigger(holder, "value");
      }
    },
  });

  Object.defineProperty(holder, "value", {
    get() {
      if (dirty) {
        cached = runner();
        dirty = false;
      }
      track(holder, "value");
      return cached;
    },
  });

  return holder as ComputedRef<T>;
}

// --- watch ---

type WatchSource<T> = (() => T) | object;

export function watch<T>(
  source: WatchSource<T>,
  cb: (newVal: T, oldVal: T, onCleanup: (fn: () => void) => void) => void,
  options?: { immediate?: boolean; flush?: "pre" | "post" | "sync" }
) {
  const getter: () => T =
    typeof source === "function"
      ? (source as any)
      : () => traverse(source as object) as any;
  let oldVal!: T;
  let cleanup: (() => void) | undefined;
  const onCleanup = (fn: () => void) => (cleanup = fn);

  const job = () => {
    const newVal = runner();
    if (!Object.is(newVal, oldVal)) {
      cleanup?.();
      cb(newVal, oldVal, onCleanup);
      oldVal = newVal;
    }
  };
  const scheduler =
    options?.flush === "sync"
      ? job
      : options?.flush === "pre"
      ? () => queuePreJob(job)
      : () => queueJob(job);
  const runner = effect(getter, { lazy: true, scheduler });

  if (options?.immediate) job();
  else oldVal = runner();
}

const preQueue = new Set<() => void>();
let preFlushing = false;
function queuePreJob(job: () => void) {
  preQueue.add(job);
  if (!preFlushing) {
    preFlushing = true;
    Promise.resolve().then(() => {
      for (const j of preQueue) j();
      preQueue.clear();
      preFlushing = false;
    });
  }
}

function traverse(value: any, seen = new Set<any>()) {
  if (!isObject(value) || seen.has(value)) return value;
  seen.add(value);
  for (const k in value) traverse((value as any)[k], seen);
  return value;
}
```

## mini-vue.ts

```ts {1}
// mini-vue.ts
import { effect, proxyRefs, type ShallowUnwrapRefs } from "./reactive-core";

// 스타일/속성 타입
export type StyleValue = Record<string, string | number>;
export type Props = Record<string, unknown> & {
  key?: any;
  class?: string;
  style?: StyleValue;
};

// 이벤트 인보커 저장용 (엘리먼트에 심볼 속성 사용)
const INVOKERS_KEY = Symbol("vei");

type Invoker = ((e: Event) => void) & { value: (e: Event) => void };

type ElWithInvokers = Element & {
  [INVOKERS_KEY]?: Record<string, Invoker | undefined>;
};

// --- VNode & 컴포넌트 타입 ---
export type VNode = {
  type: string | Component<any, any>;
  props: Props | null;
  children: string | VNode[] | null;
  key?: any;
  el?: Node | null;
  component?: ComponentInstance | null;
};

export type ComponentInstance = {
  vnode: VNode;
  isMounted: boolean;
  subTree: VNode | null;
  state: Record<string, unknown>;
  props: Props;
  update: (() => void) | null;
  el: Node | null;
};

// 제네릭 컴포넌트: P(props), S(setup 반환)
export type Component<P extends object = {}, S extends object = {}> = {
  setup?: (props: Readonly<P>) => S | void;
  render: (ctx: ShallowUnwrapRefs<P & S>) => VNode;
};

// --- h(): VNode 생성 ---
export function h(
  type: VNode["type"],
  props: Props | null = null,
  children?: string | VNode | VNode[] | null
): VNode {
  const key = props && "key" in props ? (props as any).key : undefined;
  const normChildren: string | VNode[] | null =
    children == null
      ? null
      : typeof children === "string"
      ? children
      : Array.isArray(children)
      ? children
      : [children];
  return {
    type,
    props,
    children: normChildren,
    key,
    el: null,
    component: null,
  };
}

// --- 렌더 진입점 ---
export function render(vnode: VNode, container: Element) {
  patch(null, vnode, container, null);
}

// --- 패치 (diff) ---
function patch(
  n1: VNode | null,
  n2: VNode,
  container: Element,
  anchor: Node | null
) {
  if (typeof n2.type === "string") {
    n1 ? patchElement(n1, n2, container) : mountElement(n2, container, anchor);
  } else {
    n1
      ? updateComponent(n1, n2, container, anchor)
      : mountComponent(n2, container, anchor);
  }
}

// --- Element 처리 ---
function mountElement(vnode: VNode, container: Element, anchor: Node | null) {
  const el = (vnode.el = document.createElement(vnode.type as string));
  patchProps(null, vnode.props, el as Element);
  mountChildren(vnode, el as Element);
  container.insertBefore(el as Node, anchor);
}

function patchElement(n1: VNode, n2: VNode, _container: Element) {
  const el = (n2.el = n1.el)! as Element;
  patchProps(n1.props, n2.props, el);
  patchChildren(n1, n2, el);
}

function mountChildren(vnode: VNode, el: Element) {
  const c = vnode.children;
  if (typeof c === "string") (el as HTMLElement).textContent = c;
  else if (Array.isArray(c))
    for (const child of c) patch(null, child, el, null);
}

function patchChildren(n1: VNode, n2: VNode, el: Element) {
  const c1 = n1.children,
    c2 = n2.children;
  if (typeof c2 === "string") {
    if (Array.isArray(c1)) for (const old of c1) unmount(old);
    (el as HTMLElement).textContent = c2;
    return;
  }
  if (Array.isArray(c2)) {
    if (typeof c1 === "string" || c1 == null) {
      (el as HTMLElement).textContent = "";
      for (const child of c2) patch(null, child, el, null);
    } else {
      const common = Math.min(c1.length, c2.length);
      for (let i = 0; i < common; i++) patch(c1[i], c2[i], el, null);
      if (c2.length > c1.length)
        for (let i = common; i < c2.length; i++) patch(null, c2[i], el, null);
      else if (c1.length > c2.length)
        for (let i = common; i < c1.length; i++) unmount(c1[i]);
    }
  } else {
    if (Array.isArray(c1)) for (const old of c1) unmount(old);
    else if (typeof c1 === "string") (el as HTMLElement).textContent = "";
  }
}

function unmount(vnode: VNode) {
  if (typeof vnode.type === "string") {
    const node = vnode.el as Node | null;
    node?.parentNode?.removeChild(node);
  } else if (vnode.component?.subTree) {
    unmount(vnode.component.subTree);
  }
}

// --- Props & 이벤트 패치 ---
const onRE = /^on[A-Z]/;

function patchProps(
  oldProps: Props | null,
  newProps: Props | null,
  el: Element
) {
  const prev = oldProps || {};
  const next = newProps || {};
  for (const key in next) {
    const prevVal = prev[key];
    const nextVal = next[key];
    if (prevVal !== nextVal) setProp(el, key, prevVal, nextVal);
  }
  for (const key in prev) {
    if (!(key in next)) setProp(el, key, (prev as any)[key], null);
  }
}

function setProp(el: Element, key: string, prevVal: unknown, nextVal: unknown) {
  if (key === "class") {
    (el as HTMLElement).className = (nextVal as string) ?? "";
    return;
  }
  if (key === "style") {
    const style = (el as HTMLElement).style;
    const prev = (prevVal as StyleValue) || {};
    const next = (nextVal as StyleValue) || {};
    for (const k in next) style.setProperty(k, String(next[k]));
    for (const k in prev) if (!(k in next)) style.removeProperty(k);
    return;
  }
  if (onRE.test(key)) {
    const name = key.slice(2).toLowerCase();
    const host = el as ElWithInvokers;
    const invokers = (host[INVOKERS_KEY] ||= {});
    let inv = invokers[key];
    if (nextVal) {
      if (!inv) {
        inv = ((e: Event) => (inv as Invoker).value(e)) as Invoker;
        inv.value = nextVal as (e: Event) => void;
        invokers[key] = inv;
        el.addEventListener(name, inv);
      } else {
        inv.value = nextVal as (e: Event) => void;
      }
    } else if (inv) {
      el.removeEventListener(name, inv);
      invokers[key] = undefined;
    }
    return;
  }
  if (key === "value" && "value" in (el as any)) {
    (el as any).value = nextVal ?? "";
    return;
  }
  if (key === "checked" && "checked" in (el as any)) {
    (el as any).checked = Boolean(nextVal);
    return;
  }
  if (nextVal == null || nextVal === false) el.removeAttribute(key);
  else el.setAttribute(key, String(nextVal));
}

// --- 컴포넌트 처리 ---
function mountComponent(vnode: VNode, container: Element, anchor: Node | null) {
  const comp = vnode.type as Component<any, any>;
  const instance: ComponentInstance = {
    vnode,
    isMounted: false,
    subTree: null,
    state: {},
    props: vnode.props || {},
    update: null,
    el: null,
  };
  vnode.component = instance;

  const setupState = comp.setup?.(instance.props as any);
  if (setupState && typeof setupState === "object")
    instance.state = setupState as Record<string, unknown>;

  const updateComponent = () => {
    const ctx = proxyRefs({
      ...instance.props,
      ...instance.state,
    }) as ShallowUnwrapRefs<Record<string, unknown>>;
    const nextTree = comp.render(ctx as any);
    if (!instance.isMounted) {
      patch(null, nextTree, container, anchor);
      instance.isMounted = true;
    } else {
      patch(instance.subTree!, nextTree, container, anchor);
    }
    instance.subTree = nextTree;
    vnode.el = instance.el = nextTree.el!;
  };

  instance.update = effect(updateComponent);
}

function updateComponent(
  n1: VNode,
  n2: VNode,
  _container: Element,
  _anchor: Node | null
) {
  const instance = (n2.component = n1.component)!;
  n2.el = n1.el;
  instance.vnode = n2;
  instance.props = n2.props || {};
  instance.update && instance.update();
}

// --- 앱 생성기 ---
export function createApp<P extends object = {}, S extends object = {}>(
  root: Component<P, S>
) {
  return {
    mount(selectorOrEl: string | Element) {
      const container =
        typeof selectorOrEl === "string"
          ? (document.querySelector(selectorOrEl) as Element)
          : selectorOrEl;
      const vnode = h(root as any, null, null);
      render(vnode, container);
    },
  };
}
```

## main.ts

```ts {1}
// main.ts
import { reactive, ref, computed, type ComputedRef } from "./reactive-core";
import { h, createApp, type Component, type VNode } from "./mini-vue";

// 공통 UI
const Box = (children: VNode[] | string, extra?: Record<string, unknown>) =>
  h(
    "div",
    {
      class: "box",
      style: {
        padding: "12px",
        border: "1px solid #ddd",
        borderRadius: "12px",
        marginBottom: "12px",
        ...(extra?.style as any),
      },
    },
    children
  );

// 문자열을 VNode로 정규화하여 children 타입 충돌 제거
const Row = (children: Array<VNode | string>): VNode =>
  h(
    "div",
    { style: { display: "flex", gap: "8px" } },
    children.map((c) => (typeof c === "string" ? h("span", null, c) : c))
  );

const Button = (label: string, onClick: (e: Event) => void) =>
  h(
    "button",
    {
      onClick,
      style: {
        padding: "6px 10px",
        borderRadius: "8px",
        border: "1px solid #ccc",
        cursor: "pointer",
      },
    },
    label
  );

// --- Counter ---

type CounterState = {
  state: { count: number };
  double: ComputedRef<number>;
  inc: () => void;
  dec: () => void;
};

const Counter: Component<{}, CounterState> = {
  setup() {
    const state = reactive({ count: 0 });
    const double = computed(() => state.count * 2);
    const inc = () => {
      state.count++;
    };
    const dec = () => {
      state.count--;
    };
    const ret: CounterState = { state, double, inc, dec };
    return ret;
  },
  render(ctx) {
    // ctx.double, ctx.state.count 는 언랩/추론됨
    return Box([
      h("h2", null, "Counter"),
      h("p", null, `count = ${ctx.state.count} / double = ${ctx.double}`),
      Row([Button("+1", ctx.inc), Button("-1", ctx.dec)]),
    ]);
  },
};

// --- TodoList ---

interface Todo {
  id: number;
  text: string;
}

type TodoState = {
  input: ReturnType<typeof ref<string>>; // ref<string>
  todos: ReturnType<typeof reactive<Todo[]>>; // Todo[] (Proxy)
  add: () => void;
  remove: (idx: number) => void;
};

const TodoList: Component<{}, TodoState> = {
  setup() {
    const input = ref("");
    const todos = reactive<Todo[]>([]);
    let id = 0;

    const add = () => {
      const v = input.value.trim();
      if (!v) return;
      todos.push({ id: id++, text: v });
      input.value = "";
    };
    const remove = (idx: number) => {
      todos.splice(idx, 1);
    };

    return { input, todos, add, remove };
  },
  render(ctx) {
    // ctx.input 은 string 으로 언랩되어 세터 쓰기 가능 (proxyRefs)
    return Box([
      h("h2", null, "Todos"),
      Row([
        h("input", {
          value: ctx.input,
          onInput: (e: Event) =>
            (ctx.input = (e.target as HTMLInputElement).value),
          placeholder: "할 일을 입력...",
        }),
        Button("추가", ctx.add),
      ]),
      h(
        "ul",
        { style: { paddingLeft: "18px" } },
        ctx.todos.map((t: Todo, i: number) =>
          h(
            "li",
            {
              style: {
                margin: "4px 0",
                display: "flex",
                gap: "8px",
                alignItems: "center",
              },
            },
            [h("span", null, t.text), Button("삭제", () => ctx.remove(i))]
          )
        )
      ),
    ]);
  },
};

// --- Root ---
const App: Component = {
  render() {
    return h(
      "div",
      {
        style: {
          fontFamily: "system-ui, sans-serif",
          maxWidth: "720px",
          margin: "40px auto",
        },
      },
      [
        h("h1", null, "Mini Vue: Reactivity + Renderer"),
        h(
          "p",
          { style: { color: "#666", marginBottom: "16px" } },
          "Typed inference 데모"
        ),
        h("div", { style: { display: "grid", gap: "12px" } }, [
          h(Counter, null, null),
          h(TodoList, null, null),
        ]),
      ]
    );
  },
};

createApp(App).mount("#app");
```
