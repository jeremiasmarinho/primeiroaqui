import { useEffect, useRef, useState } from 'react'
import {
  User,
  Lock,
  Smartphone,
  Search,
  MapPin,
  Bell,
  Home,
  ShoppingBag,
  ChevronLeft,
  Map,
  Package,
  Bike,
  CheckCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  BadgePercent,
  X,
  ShoppingCart,
  CircleDollarSign,
  MessageCircle,
} from 'lucide-react'

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login')
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const historyStack = useRef([])

  useEffect(() => {
    window.history.replaceState({ screen: 'login' }, '')

    const handlePopState = (event) => {
      if (event.state?.screen) {
        setCurrentScreen(event.state.screen)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigateTo = (screen) => {
    if (screen !== currentScreen) {
      historyStack.current.push(currentScreen)
      setCurrentScreen(screen)
      window.history.pushState({ screen }, '')
    }
  }

  const handleBack = () => {
    if (historyStack.current.length > 0) {
      window.history.back()
    } else {
      setCurrentScreen('home')
    }
  }

  const handleOpenProduct = (product) => {
    setSelectedProduct(product)
  }

  const handleBuyNow = () => {
    setSelectedProduct(null)
    setIsCartOpen(true)
  }

  const handleFinalizePurchase = () => {
    setIsCartOpen(false)
    setCurrentScreen('tracking')
  }

  const demoProduct = {
    title: 'Ventilador de Mesa 3 Velocidades',
    price: 'R$ 129,90',
    subtitle: 'Chega hoje',
    seller: 'Loja Exemplo',
    image: 'https://placehold.co/800x800/png',
  }

  const featuredProducts = [
    {
      title: 'Ventilador de Mesa Premium',
      price: 'R$ 199,90',
      seller: 'Loja Vizinhança',
      rating: '4.9 • 982',
      badge: 'Frete grátis',
      image: 'https://placehold.co/400x400/ffedd5/92400e?text=Ventilador',
    },
    {
      title: 'Kit Supermercado Express',
      price: 'R$ 129,90',
      seller: 'Mercado Central',
      rating: '4.8 • 1.2k',
      badge: 'Entrega hoje',
      image: 'https://placehold.co/400x400/dbeafe/1e3a8a?text=Supermercado',
    },
    {
      title: 'Smartwatch Fitness',
      price: 'R$ 379,90',
      seller: 'Tech Shop',
      rating: '4.7 • 860',
      badge: 'Mais vendido',
      image: 'https://placehold.co/400x400/e0f2fe/0c4a6e?text=Smartwatch',
    },
    {
      title: 'Box de Cuidados Pessoais',
      price: 'R$ 84,90',
      seller: 'Farmácia Local',
      rating: '4.8 • 1.1k',
      badge: 'Economize 20%',
      image: 'https://placehold.co/400x400/ede9fe/5b21b6?text=Cuidados',
    },
    {
      title: 'Cafeteira Compacta',
      price: 'R$ 239,90',
      seller: 'Casa & Cozinha',
      rating: '4.6 • 740',
      badge: 'Pronta entrega',
      image: 'https://placehold.co/400x400/ccfbf1/115e59?text=Cafeteira',
    },
    {
      title: 'Fone Bluetooth',
      price: 'R$ 149,90',
      seller: 'AudioMix',
      rating: '4.9 • 1.4k',
      badge: 'Top avaliações',
      image: 'https://placehold.co/400x400/f1f5f9/334155?text=Fone',
    },
    {
      title: 'Tênis Esportivo',
      price: 'R$ 169,90',
      seller: 'Moda Ativa',
      rating: '4.7 • 860',
      badge: 'Melhor custo',
      image: 'https://placehold.co/400x400/fef3c7/713f12?text=T%C3%AAnis',
    },
    {
      title: 'Camiseta Casual',
      price: 'R$ 59,90',
      seller: 'Look Store',
      rating: '4.8 • 940',
      badge: 'Parcelamento',
      image: 'https://placehold.co/400x400/e9d5ff/5b21b6?text=Camiseta',
    },
  ]

  const LoginScreen = () => (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#ffe600] p-6 font-sans animate-in fade-in duration-300">
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-[32px] bg-white/95 p-6 shadow-2xl">
        <div className="flex items-center gap-4 rounded-[28px] bg-[#f4f4f4] p-4">
          <img src="/logo.png" alt="Primeiro Aqui" className="h-16 w-auto object-contain" />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-900">Primeiro Aqui</p>
            <p className="text-xs text-slate-500">O marketplace local com confiança e agilidade</p>
          </div>
        </div>

        <div className="space-y-3 rounded-[28px] bg-slate-900 p-6 text-white shadow-lg">
          <h1 className="text-3xl font-black">Compre de quem está perto de você</h1>
          <p className="text-sm leading-6 text-slate-200">Ofertas locais, frete rápido e pagamento seguro para a sua região.</p>
          <div className="flex flex-wrap gap-2">
            {['Ofertas', 'Supermercado', 'Farmácia', 'Moda', 'Eletro'].map((item) => (
              <span key={item} className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white">{item}</span>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <div className="flex items-center rounded-2xl bg-gray-100 p-3">
            <User className="mr-3 h-5 w-5 text-gray-400" />
            <input type="text" placeholder="E-mail ou CPF" className="w-full bg-transparent outline-none text-slate-800" />
          </div>
          <div className="mt-4 flex items-center rounded-2xl bg-gray-100 p-3">
            <Lock className="mr-3 h-5 w-5 text-gray-400" />
            <input type="password" placeholder="Senha" className="w-full bg-transparent outline-none text-slate-800" />
          </div>
          <button
            onClick={() => navigateTo('home')}
            className="mt-6 w-full rounded-2xl bg-slate-900 py-4 font-bold text-white transition hover:bg-slate-800"
          >
            Entrar no app
          </button>
          <button
            onClick={() => navigateTo('home')}
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-white py-4 font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Teste como convidado
          </button>
        </div>
      </div>
    </div>
  )

  const HomeScreen = () => (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gray-50 font-sans animate-in fade-in duration-300">
      <header className="bg-[#ffe600] border-b border-[#f3d300] px-4 py-4 shadow-sm md:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm">
                <img src="/logo.png" alt="Primeiro Aqui" className="h-10 w-auto object-contain" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-800">Primeiro Aqui</p>
                <p className="text-sm font-bold text-slate-900">Marketplace local premium</p>
              </div>
            </div>

            <div className="order-last flex items-center gap-2 md:order-none">
              <button className="hidden rounded-full bg-white/90 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-white md:inline-flex">Criar conta</button>
              <button onClick={() => navigateTo('tracking')} className="hidden rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 md:inline-flex">Entrar</button>
              <button onClick={() => setIsCartOpen(true)} className="rounded-full bg-white p-3 shadow-sm text-slate-900">
                <ShoppingCart className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-[28px] bg-white p-4 shadow-lg md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Buscar produtos, marcas e muito mais</p>
              <h1 className="mt-2 text-3xl font-black text-slate-900">Ofertas do seu bairro com entrega rápida e preço justo</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">Explore lojas locais, produtos de qualidade e promoções exclusivas para a sua região.</p>
            </div>
            <div className="relative w-full md:w-[420px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Buscar por produtos, lojas ou promoções" className="w-full rounded-full border border-slate-200 bg-slate-100 px-14 py-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400" />
            </div>
          </div>

          <div className="hidden items-center justify-between gap-2 overflow-x-auto rounded-full bg-white/90 px-3 py-3 text-sm font-semibold text-slate-800 shadow-sm no-scrollbar md:flex">
            {['Ofertas', 'Supermercado', 'Farmácia', 'Moda', 'Casa', 'Eletro', 'Vem+'].map((category) => (
              <button key={category} className="rounded-full px-4 py-2 transition hover:bg-slate-100">{category}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 no-scrollbar md:pb-8">
        <div className="mx-4 mt-4 grid gap-4 md:mx-6 lg:mx-8 lg:grid-cols-[1.4fr_0.9fr]">
          <section className="rounded-[32px] bg-gradient-to-br from-[#fff7cb] via-[#ffe88b] to-[#ffdd2a] p-6 shadow-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-white">Lançamento</span>
                <h2 className="mt-4 text-4xl font-black leading-tight text-slate-900">Aqui você encontra tudo o que precisa com entrega expressa.</h2>
                <p className="mt-4 max-w-lg text-sm leading-6 text-slate-700">Produtos de casa, eletrônico, supermercado e farmácia, com entrega rápida e seguro de compra.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: Sparkles, label: 'Ofertas exclusivas' },
                    { icon: ShieldCheck, label: 'Compra segura' },
                    { icon: Truck, label: 'Entrega expressa' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 rounded-3xl bg-white/90 px-4 py-3 shadow-sm">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={() => handleOpenProduct(demoProduct)} className="rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white transition hover:bg-slate-800">Ver ofertas</button>
                  <button className="rounded-full border border-slate-900 bg-white px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100">Ver cupons</button>
                </div>
              </div>
              <div className="relative mx-auto h-72 w-full max-w-[420px] overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
                <img src="https://placehold.co/640x640/fff7ed/92400e?text=Entrega+Rápida" alt="Destaque" className="h-full w-full object-cover" />
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            {[
              { title: 'Frete grátis', description: 'Nas melhores ofertas da região', icon: Truck },
              { title: 'Pagamento seguro', description: 'Cartão, Pix e boleto', icon: ShieldCheck },
              { title: 'Rastreio fácil', description: 'Acompanhe passo a passo', icon: Map },
            ].map((item) => (
              <div key={item.title} className="rounded-[28px] bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff6ff] text-slate-900">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{item.title}</h3>
                    <p className="text-sm text-slate-500">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </aside>
        </div>

        <div className="mx-4 mt-4 rounded-[24px] bg-white p-4 shadow-sm md:mx-6 lg:mx-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: ShoppingBag, label: 'Supermercado' },
              { icon: ShieldCheck, label: 'Farmácia' },
              { icon: Truck, label: 'Internet' },
              { icon: Map, label: 'Casa' },
              { icon: Star, label: 'Promoções' },
              { icon: CircleDollarSign, label: 'Ofertas' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm text-slate-900">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="font-semibold text-slate-900">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-4 mt-6 rounded-[32px] bg-[#f8fafc] p-6 shadow-sm md:mx-6 lg:mx-8">
          <div className="flex flex-col gap-4 rounded-[28px] bg-white p-6 shadow-lg md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Clientes que confiam</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">Atendimento local com experiência doméstica</h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">Compras mais rápidas, suporte humano e avaliações reais de quem mora na sua região.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { name: 'Mariana', detail: 'Compra todo mês', image: 'https://placehold.co/192x192/fde68a/78350f?text=Mariana' },
                { name: 'Lucas', detail: 'Pedido em 1h', image: 'https://placehold.co/192x192/bae6fd/0c4a6e?text=Lucas' },
                { name: 'Ana', detail: 'Entrega garantida', image: 'https://placehold.co/192x192/c7d2fe/3730a3?text=Ana' },
              ].map((customer) => (
                <div key={customer.name} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-center shadow-sm">
                  <img src={customer.image} alt={customer.name} className="mx-auto mb-3 h-20 w-20 rounded-3xl object-cover shadow-md" />
                  <p className="font-bold text-slate-900">{customer.name}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{customer.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-4 mt-4 px-4 md:px-6 lg:mx-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900">Mais buscados</h3>
              <p className="text-sm text-slate-500">Produtos populares com entrega rápida.</p>
            </div>
            <span className="text-sm font-semibold text-blue-600">Ver tudo</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
              <div key={item} onClick={() => handleOpenProduct(demoProduct)} className="cursor-pointer rounded-[20px] border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-2 h-24 overflow-hidden rounded-xl bg-slate-100">
                  <img src="https://placehold.co/400x400/png" alt="Produto" className="h-full w-full object-cover" />
                </div>
                <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-yellow-50 px-2 py-1 text-[11px] font-semibold text-yellow-700">
                  <span>Frete grátis</span>
                </div>
                <p className="text-sm font-semibold text-slate-700">Ventilador de Mesa</p>
                <div className="mt-2 flex items-center justify-between gap-2 text-slate-900">
                  <span className="text-base font-black">R$ 199,90</span>
                  <span className="text-xs font-semibold text-slate-500">4.8</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-3 overflow-x-auto px-4 no-scrollbar md:px-6 lg:px-8">
          {[
            { name: 'Mercado', color: 'bg-emerald-100 text-emerald-700' },
            { name: 'Farmácia', color: 'bg-rose-100 text-rose-700' },
            { name: 'Eletrônica', color: 'bg-blue-100 text-blue-700' },
            { name: 'Moda', color: 'bg-violet-100 text-violet-700' },
            { name: 'Casa', color: 'bg-amber-100 text-amber-700' },
          ].map((cat, i) => (
            <div key={i} className="flex min-w-[84px] flex-col items-center gap-2 rounded-[16px] bg-white px-2 py-3 shadow-sm">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${cat.color} text-xl font-bold shadow-sm`}>
                {cat.name[0]}
              </div>
              <span className="text-xs font-semibold text-gray-600">{cat.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 px-4 md:px-6 lg:px-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-gray-900">Mais buscados</h3>
              <p className="text-sm text-gray-500">Produtos com melhor avaliação e entrega rápida</p>
            </div>
            <span className="text-sm font-semibold text-blue-600">Ver tudo</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            {featuredProducts.map((product) => (
              <div key={product.title} onClick={() => handleOpenProduct(product)} className="cursor-pointer rounded-[20px] border border-gray-100 bg-white p-3 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                <div className="mb-2 h-24 overflow-hidden rounded-xl bg-gray-100">
                  <img src={product.image} alt={product.title} className="h-full w-full object-cover" />
                </div>
                <div className="mb-1 flex items-center gap-1 text-amber-500">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span className="text-[11px] font-semibold text-gray-500">{product.rating}</span>
                </div>
                <span className="text-base font-black text-slate-800">{product.price}</span>
                <p className="mt-1 text-xs text-gray-500">{product.badge}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-green-700">
                  <CircleDollarSign className="h-3.5 w-3.5" />
                  {product.seller}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <nav className="absolute bottom-0 z-20 flex w-full justify-around border-t border-gray-200 bg-white px-2 py-3 pb-5 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] md:hidden">
        <div className="flex cursor-pointer flex-col items-center text-blue-600" onClick={() => setCurrentScreen('home')}>
          <Home className="h-6 w-6" />
          <span className="mt-1 text-[10px] font-bold">Início</span>
        </div>
        <div className="flex cursor-pointer flex-col items-center text-gray-400" onClick={() => setIsCartOpen(true)}>
          <ShoppingBag className="h-6 w-6" />
          <span className="mt-1 text-[10px] font-medium">Pedidos</span>
        </div>
        <div className="flex flex-col items-center text-gray-400">
          <User className="h-6 w-6" />
          <span className="mt-1 text-[10px] font-medium">Perfil</span>
        </div>
      </nav>

      {selectedProduct && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="relative w-full max-w-2xl rounded-[28px] bg-white p-4 shadow-2xl md:p-6">
            <button onClick={() => setSelectedProduct(null)} className="absolute right-4 top-4 rounded-full bg-gray-100 p-2 text-gray-600">
              <X className="h-5 w-5" />
            </button>
            <div className="grid gap-6 md:grid-cols-2">
              <img src={selectedProduct.image} alt={selectedProduct.title} className="h-72 w-full rounded-[24px] object-cover" />
              <div className="flex flex-col justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-600">Produto destaque</p>
                  <h3 className="mt-2 text-2xl font-black text-slate-900">{selectedProduct.title}</h3>
                  <p className="mt-2 text-sm text-gray-600">Design moderno, operação silenciosa e entrega rápida.</p>
                  <div className="mt-4 rounded-2xl bg-green-50 p-3 text-green-700">
                    <p className="font-black">{selectedProduct.subtitle}</p>
                  </div>
                  <div className="mt-6 text-3xl font-black text-slate-900">{selectedProduct.price}</div>
                  <p className="mt-2 text-sm font-medium text-gray-500">Vendido e entregue por: {selectedProduct.seller}</p>
                </div>
                <div className="mt-6 flex flex-col gap-3">
                  <button onClick={handleBuyNow} className="w-full rounded-2xl bg-blue-600 py-3 font-bold text-white transition hover:bg-blue-700">
                    Comprar agora
                  </button>
                  <button onClick={() => setIsCartOpen(true)} className="w-full rounded-2xl bg-blue-50 py-3 font-semibold text-blue-700 transition hover:bg-blue-100">
                    Adicionar ao carrinho
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {isCartOpen && (
        <div className="fixed inset-y-0 right-0 z-50 flex w-full bg-slate-900/50 md:w-96">
          <div className="ml-auto flex h-full w-full flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Carrinho</h3>
                <p className="text-sm text-gray-500">1 item selecionado</p>
              </div>
              <button onClick={() => setIsCartOpen(false)} className="rounded-full bg-gray-100 p-2 text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 p-4">
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center gap-3">
                  <img src={demoProduct.image} alt={demoProduct.title} className="h-16 w-16 rounded-xl object-cover" />
                  <div>
                    <p className="font-bold text-slate-900">{demoProduct.title}</p>
                    <p className="text-sm text-gray-500">{demoProduct.seller}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-700">
                <div className="mb-2 flex justify-between"><span>Subtotal</span><span>R$ 129,90</span></div>
                <div className="mb-2 flex justify-between"><span>Frete</span><span>R$ 0,00</span></div>
                <div className="flex justify-between border-t border-gray-200 pt-2 font-black text-slate-900"><span>Total</span><span>R$ 129,90</span></div>
              </div>
            </div>

            <div className="border-t border-gray-200 p-4">
              <button onClick={handleFinalizePurchase} className="w-full rounded-2xl bg-green-600 py-3 font-bold text-white transition hover:bg-green-700">
                Finalizar Compra
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const TrackingScreen = () => (
    <div className="relative flex min-h-screen w-full flex-col bg-gray-50 font-sans animate-in fade-in duration-300 md:flex-row md:bg-gray-100">
      <header className="z-10 flex items-center gap-4 bg-white px-4 py-5 shadow-sm md:hidden">
        <ChevronLeft className="h-6 w-6 cursor-pointer text-gray-800" onClick={handleBack} />
        <h2 className="text-lg font-bold text-gray-800">Acompanhar Pedido</h2>
      </header>

      <div className="relative flex h-64 w-full flex-col items-center justify-center bg-[linear-gradient(135deg,#dbeafe_0%,#93c5fd_100%)] md:h-auto md:w-[60%] md:min-h-screen md:rounded-r-[32px]">
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-md md:left-6 md:top-6">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <span className="text-xs font-bold text-gray-700">Entrega Segura</span>
        </div>
        <Map className="absolute h-20 w-20 text-slate-400 opacity-20 md:h-32 md:w-32" />
        <div className="z-10 rounded-full bg-blue-600 px-4 py-2 font-bold text-white shadow-lg">12 min para chegar</div>
      </div>

      <div className="z-20 flex flex-1 flex-col rounded-t-3xl bg-white p-6 md:rounded-none md:rounded-l-[32px] md:p-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-black text-gray-800">Carlos Eduardo</h3>
            <p className="text-sm font-medium text-gray-500">Honda CG 160 • Placa ABC-1234</p>
          </div>
          <div className="h-12 w-12 rounded-full border-2 border-[#FFE600] bg-gray-200" />
        </div>
        <div className="mb-6 flex items-center justify-between rounded-2xl border border-[#FFE600] bg-[#FFF8B8] p-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-slate-700" />
            <span className="text-sm font-bold text-slate-800">Senha de liberação:</span>
          </div>
          <span className="text-2xl font-black tracking-widest text-slate-900">7492</span>
        </div>
        <div className="relative ml-2 flex-1">
          <div className="absolute bottom-6 left-3 top-2 w-0.5 bg-gray-200" />
          <div className="relative mb-6 flex gap-4">
            <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 ring-4 ring-white">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
            <div className="-mt-1">
              <p className="font-bold text-gray-800">Pedido Confirmado</p>
              <p className="text-xs text-gray-400">14:32</p>
            </div>
          </div>
          <div className="relative mb-6 flex gap-4">
            <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-green-500 ring-4 ring-white">
              <Package className="h-3 w-3 text-white" />
            </div>
            <div className="-mt-1">
              <p className="font-bold text-gray-800">Coletado na Loja</p>
              <p className="text-xs text-gray-400">14:45</p>
            </div>
          </div>
          <div className="relative flex gap-4">
            <div className="z-10 flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-blue-600 ring-4 ring-white">
              <Bike className="h-3 w-3 text-white" />
            </div>
            <div className="-mt-1">
              <p className="font-bold text-blue-600">A caminho do seu endereço</p>
              <p className="text-xs text-gray-400">Chegada estimada: 15:02</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return <div className="min-h-screen w-full bg-gray-900">{currentScreen === 'login' && <LoginScreen />}{currentScreen === 'home' && <HomeScreen />}{currentScreen === 'tracking' && <TrackingScreen />}</div>
}
