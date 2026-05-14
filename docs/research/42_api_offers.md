# Pesquisa: Vagas de Estágio via API da 42

Este documento resume a viabilidade de utilizar a API da 42 para buscar e filtrar vagas de estágio por localização, visando a criação de uma ferramenta "Find Internship".

## Viabilidade Técnica
A API da 42 (`api.intra.42.fr`) fornece acesso completo aos dados do portal de empresas (`companies.intra.42.fr`) através do endpoint `/v2/offers`.

## Endpoint Principal
`GET /v2/offers`

### Parâmetros de Filtragem Úteis:
| Parâmetro | Descrição |
| :--- | :--- |
| `filter[city]` | Filtra vagas por cidade específica. |
| `filter[country]` | Filtra vagas por país. |
| `filter[campus_id]` | Filtra vagas vinculadas a um campus ID específico. |
| `filter[contract_type]` | Filtra por tipo de contrato (ex: `internship`). |

### Campos Disponíveis no Retorno:
- `title`: Título da vaga.
- `big_description`: Descrição detalhada.
- `salary`: Informação salarial (se disponível).
- `address`, `city`, `zip`, `country`: Informações de localização.
- `company_id`: ID da empresa anunciante.
- `valid_at` / `invalid_at`: Período de validade da vaga.

## Sugestão de Implementação
Para um projeto como o "Find Internship", a abordagem recomendada é:
1. **Backend (NestJS):** Criar um serviço que consulte este endpoint e possivelmente armazene em cache ou processe as vagas para alertas automáticos.
2. **Frontend:** Uma interface amigável para busca e visualização.
3. **Automação:** Uso de Cron Jobs (via `@nestjs/schedule`) para monitorar novas vagas em países específicos.

---
*Documento gerado em May 2026 como referência para futura implementação.*
