import { exemploLancheria } from '@radar/lancheria-rx/contrato';
import type { DemoData, SkinDefinition } from '../types';
import { exemploDaSkin, varianteEfetiva } from '../variantes';

/** Fixtures explícitas, usadas apenas no harness interno e nos testes.
 *  `varianteId` escolhe a camada de exemplo — sem ele as quatro variantes
 *  renderizariam a primeira, e o harness compararia a mesma coisa 4x. */
export function dadosQaLancheria(skin: SkinDefinition, varianteId?: string, cenario='padrao'): DemoData {
  const data=structuredClone(exemploDaSkin(skin,varianteId));
  const tema=(varianteEfetiva(skin,varianteId)?.theme ?? skin.themeDefault).lancheria!;
  const {casa}=exemploLancheria(tema.hero);
  Object.assign(data,{nome:casa.nome,cidade:casa.cidade,endereco:casa.endereco,telefone:casa.telefone,whatsapp:casa.whatsapp});
  data.lancheria!.funcionamento.confirmado=true;
  if(cenario==='cliente') {
    Object.assign(data,{nome:'Sanduicheria da Praça',cidade:'Londrina, PR',endereco:'Rua de Teste, 260',telefone:'(43) 3000-2600',whatsapp:'5543999992600'});
    const c=data.lancheria!;
    c.funcionamento={abre:'11:30',fecha:'22:15',fuso:'America/Sao_Paulo',pagamento:['Pix','Cartão','Dinheiro'],confirmado:true};
    c.precoBaseCent=950;
    const nomes=['Prensado da Praça com frango, calabresa e queijo especial da madrugada','Especial do balcão com bacon crocante e queijo','Prensado de calabresa com cebola e molho da casa','Duplo da Praça com queijo e salada especial','Redondo de frango com queijo cremoso e milho','Redondo completo do bairro com bacon e ovo'];
    c.ingredientes=c.ingredientes.map((x,i)=>({...x,precoCent:x.precoCent+75+i}));
    c.lanches=c.lanches.map((x,i)=>({...x,slug:`receita-cliente-${i+1}`,nome:nomes[i],precoCent:4100+i*350,
      camadas:[...x.camadas.slice(0,1),...x.camadas.slice(1,-1).filter(s=>s!=='alface'),x.camadas.at(-1)!],
      essenciais:x.essenciais.filter(s=>s!=='alface'),
    }));
    c.textos={...c.textos,historiaTitulo:'A cozinha da Praça',historia:['Receitas de teste para verificar a injeção do catálogo.'],carimbo:'LONDRINA / PRAÇA / CHAPA'};
  }
  return data;
}
