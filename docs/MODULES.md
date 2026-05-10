# 모듈별 역할 문서

본 문서는 Chat-Server 프로젝트의 Gradle 멀티 모듈 구조와 각 모듈의 역할, 그리고 모듈 간 의존 관계를 정리한 것입니다. 프로젝트는 Kotlin + Spring Boot 3.3.4 기반이며 JPA, Redis, WebSocket, PostgreSQL을 사용한 분산 채팅 서버입니다.

## 1. 전체 구조 개요

```
chat (root)
├── chat-application   # 부트스트랩 (실행 진입점)
├── chat-api           # REST API (컨트롤러)
├── chat-domain        # 도메인 모델, DTO, 서비스 인터페이스
├── chat-persistence   # JPA 리포지토리, Redis, 서비스 구현
└── chat-websocket     # WebSocket 핸들러, 인터셉터
```

### 의존 방향

```
chat-application ──┬──> chat-api ─────────> chat-domain
                   ├──> chat-websocket ───> chat-persistence ──> chat-domain
                   ├──> chat-persistence ─> chat-domain
                   └──> chat-domain
```

- `chat-domain`은 최하단 모듈로 어떤 모듈에도 의존하지 않습니다. (순수 도메인 / DTO / 서비스 인터페이스)
- `chat-api`, `chat-persistence`는 `chat-domain`에만 의존합니다.
- `chat-websocket`은 `chat-domain`과 `chat-persistence`에 의존하여 세션/브로커 기능을 재사용합니다.
- `chat-application`은 위 4개 모듈을 모두 포함해 실제 Spring Boot 애플리케이션을 조립/실행합니다.

> 빌드 정책: `chat-domain`은 `BootJar`가 비활성화되어 일반 Jar로만 산출물이 생성됩니다. (`chat-domain/build.gradle.kts:8-14`) 실행 가능한 Fat Jar는 `chat-application` 모듈에서만 만들어집니다.

---

## 2. chat-application — 애플리케이션 조립 및 실행

**위치**: `chat-application/`

**핵심 파일**: `chat-application/src/main/kotlin/ChatApplication.kt`

### 역할
Spring Boot의 메인 진입점입니다. 다른 모든 모듈을 `implementation project(...)`로 포함하여 단일 실행 가능한 Boot Jar를 만드는 "조립자(assembler)" 역할을 합니다.

### 주요 책임
1. `main()` 함수와 `@SpringBootApplication`을 가지는 실행 가능한 모듈.
2. `scanBasePackages`로 `com.chat.application`, `com.chat.domain`, `com.chat.persistence`, `com.chat.api`, `com.chat.websocket` 전 패키지를 명시적으로 스캔합니다.
3. JPA 관련 전역 설정을 관리합니다.
   - `@EnableJpaAuditing` — `@CreatedDate`/`@LastModifiedDate` 감사 기능 활성화
   - `@EnableJpaRepositories(basePackages = ["com.chat.persistence.repository"])` — 리포지토리 스캔 범위 제한
   - `@EntityScan(basePackages = ["com.chat.domain.model"])` — 엔티티 스캔 범위 제한
4. 런타임 의존성(`postgresql`, `h2`)을 포함하여 실제 DB 구동이 이 모듈에서만 가능합니다.
5. `application-docker.yml` 등 프로파일별 설정 파일을 소유합니다.

### 의존성
- `chat-api`, `chat-domain`, `chat-persistence`, `chat-websocket` (전체)
- `spring-boot-starter`, `spring-boot-starter-actuator`, `spring-boot-starter-data-jpa`
- 런타임: `postgresql`, `h2`

---

## 3. chat-domain — 도메인 모델과 서비스 인터페이스

**위치**: `chat-domain/`

**핵심 구성**
- `model/` : JPA 엔티티 (`User`, `ChatRoom`, `ChatRoomMember`, `Message`)
- `dto/` : API/WebSocket DTO (`UserDto`, `ChatDto`, `WebSocketDto`)
- `service/` : 서비스 인터페이스 (`UserService`, `ChatService`)

### 역할
시스템의 **순수한 비즈니스 표현 계층**입니다. 구현 세부사항(JPA 구현체, Redis, Web MVC 등)을 제외한 도메인 모델과 DTO, 서비스 계약만 정의합니다. 이 모듈을 중심으로 `api`, `persistence`, `websocket`이 DIP(의존성 역전)에 따라 연결됩니다.

### 주요 구성 요소

#### 도메인 엔티티 (`model/`)
| 엔티티 | 주요 필드 | 목적 |
|--------|----------|------|
| `User` (`app_users`) | `username`, `password`, `displayName`, `lastSeenAt`, `isActive` | 사용자 계정 |
| `ChatRoom` (`chat_rooms`) | `name`, `type (DIRECT/GROUP/CHANNEL)`, `maxMembers`, `createdBy` | 채팅방 |
| `ChatRoomMember` (`chat_room_members`) | `chatRoom`, `user`, `role (OWNER/ADMIN/MEMBER)`, `lastReadMessageId` | 채팅방-사용자 조인 엔티티 |
| `Message` (`messages`) | `chatRoom`, `sender`, `content`, `sequenceNumber`, `isDeleted` | 메시지 본문 |

- 모든 엔티티에 `@EntityListeners(AuditingEntityListener::class)`가 적용되어 생성/수정 일시가 자동 기록됩니다.
- 성능을 위해 `idx_message_room_time`, `idx_message_room_sequence` 등 복합 인덱스가 엔티티 선언에 정의되어 있습니다. (`chat-domain/src/main/kotlin/model/Message.kt:10-18`)

#### DTO (`dto/`)
- `UserDto`, `ChatRoomDto`, `MessageDto` — API 응답 DTO
- `CreateUserRequest`, `LoginRequest`, `CreateChatRoomRequest`, `SendMessageRequest` — Bean Validation이 적용된 요청 DTO
- `MessagePageRequest`, `MessagePageResponse`, `MessageDirection` — **커서 기반 페이지네이션** DTO
- `WebSocketDto.kt` — 실시간 메시지용 `sealed class WebSocketMessage`
  - Jackson `@JsonTypeInfo` + `@JsonSubTypes`로 `ChatMessage`/`ErrorMessage` 다형 직렬화
  - 이를 통해 서버-클라이언트 간 타입 안전한 JSON 메시지 교환이 가능

#### 서비스 인터페이스 (`service/`)
- `UserService` — 사용자 CRUD, 로그인, 마지막 접속 시각 갱신 계약
- `ChatService` — 채팅방/멤버/메시지 관리 계약 (커서 기반 페이지네이션 메서드 포함)

### 의존성
- `spring-boot-starter-data-jpa` (엔티티 어노테이션용)
- `spring-boot-starter-validation` (Bean Validation용)
- `spring-data-commons` (`Page`, `Pageable`)
- `jackson-module-kotlin` (WebSocketDto 직렬화)

### 특이사항
- `BootJar` 비활성화 / 일반 `Jar`만 생성 — 라이브러리 성격 모듈임을 명시
- 아무 구현체도 포함하지 않으므로 테스트 고립성이 높음

---

## 4. chat-api — REST API 계층

**위치**: `chat-api/`

**핵심 구성**
- `controller/` : `UserController`, `ChatController`
- `config/` : `WebConfig` (CORS 설정)

### 역할
HTTP 기반 RESTful API 엔드포인트를 제공합니다. `chat-domain`의 서비스 인터페이스에만 의존하며, 실제 구현은 Spring DI로 주입받습니다.

### 주요 엔드포인트

#### `UserController` — `/users`
| Method | Path | 설명 |
|--------|------|------|
| POST | `/users/register` | 회원가입 |
| POST | `/users/login` | 로그인 |
| GET | `/users/{id}` | 사용자 조회 |
| GET | `/users/me?userId={id}` | 현재 사용자 조회 |
| GET | `/users/search?username={q}` | 사용자 검색 (페이징) |

#### `ChatController` — `/chat-rooms`
| Method | Path | 설명 |
|--------|------|------|
| POST | `/chat-rooms` | 채팅방 생성 |
| GET | `/chat-rooms/{id}` | 채팅방 상세 |
| GET | `/chat-rooms?userId=...` | 내가 속한 채팅방 목록 (페이징) |
| POST | `/chat-rooms/{id}/members` | 채팅방 참여 |
| DELETE | `/chat-rooms/{id}/members/me` | 채팅방 나가기 |
| GET | `/chat-rooms/{id}/members` | 멤버 목록 |
| GET | `/chat-rooms/{id}/messages` | 메시지 히스토리 (Offset 기반) |
| GET | `/chat-rooms/{id}/messages/cursor` | **커서 기반** 메시지 조회 |
| GET | `/chat-rooms/search?q=...` | 채팅방 검색 |

메시지 **전송**은 REST가 아닌 WebSocket으로만 수행됩니다. REST 쪽은 히스토리 조회만 담당합니다.

### 기타 설정
- `WebConfig` — `cors.origin` 프로퍼티로부터 허용 Origin을 주입받아 CORS 매핑. `GET/POST/PUT/DELETE/PATCH/OPTIONS` 전역 허용, `allowCredentials=true`. (`chat-api/src/main/kotlin/config/WebConfig.kt:9-21`)

### 의존성
- `chat-domain` (컨트롤러는 `ChatService`, `UserService` 인터페이스만 사용)
- `spring-boot-starter-web`, `spring-boot-starter-validation`, `spring-boot-starter-actuator`, `spring-data-commons`

---

## 5. chat-persistence — 데이터 접근 / Redis / 서비스 구현

**위치**: `chat-persistence/`

**핵심 구성**
- `repository/` : `UserRepository`, `ChatRoomRepository`, `ChatRoomMemberRepository`, `MessageRepository`
- `service/` : `UserServiceImpl`, `ChatServiceImpl`, `WebSocketSessionManager`, `MessageSequenceService`
- `redis/` : `RedisMessageBroker`
- `config/` : `RedisConfig`, `CacheConfig`

### 역할
프로젝트의 **가장 무거운 모듈**로, 다음 4가지를 모두 담당합니다.

1. **JPA 리포지토리** — DB 접근 계층
2. **도메인 서비스 구현체** — `chat-domain`의 서비스 인터페이스에 대한 실제 구현
3. **Redis 연동** — 서버 간 Pub/Sub 메시지 브로커 및 캐시
4. **WebSocket 세션 매니저** — 실제로는 세션 맵을 관리하기 때문에 persistence로 분류

### 주요 구성 요소

#### 5-1. Repository 계층 (`repository/`)
- **`MessageRepository`**: 커서 기반 페이지네이션(`findMessagesBefore`, `findMessagesAfter`, `findLatestMessages`)과 `JOIN FETCH`로 N+1을 회피. 최신 메시지 1건 조회는 네이티브 쿼리로 `LIMIT 1` 사용. (`chat-persistence/src/main/kotlin/repository/MessageRepository.kt`)
- **`ChatRoomRepository`**: 사용자별 참여 채팅방을 `JOIN`으로 조회.
- **`ChatRoomMemberRepository`**: `CrudRepository` 상속, `@Modifying` UPDATE로 소프트 delete 구현(`leaveChatRoom`).
- **`UserRepository`**: 사용자명 중복 체크, `lastSeenAt` 업데이트, 검색.

#### 5-2. 서비스 구현체 (`service/`)
- **`ChatServiceImpl`**: 핵심 비즈니스 로직. 
  - `sendMessage`: DB 저장 → 로컬 WebSocket 세션에 전송 → Redis로 다른 서버에 브로드캐스트 (`chat-persistence/src/main/kotlin/service/ChatServiceImpl.kt:289-340`)
  - Spring Cache 어노테이션(`@Cacheable`, `@CacheEvict`, `@Caching`)으로 `chatRooms`/`chatRoomMembers` 캐시 관리
- **`UserServiceImpl`**: SHA-256 패스워드 해싱 구현 (`hashPassword`). 로그인 시 해시 비교.
- **`WebSocketSessionManager`**: 
  - 서버 프로세스 로컬에 `ConcurrentHashMap<Long, MutableSet<WebSocketSession>>` 형태로 사용자별 세션 보관
  - `joinRoom`으로 해당 서버가 구독해야 할 `chat.room.{roomId}` 채널을 Redis Set(`chat:server:rooms{serverId}`)에 기록 후 `RedisMessageBroker.subscribeToRoom` 호출
  - `sendMessageToLocalRoom`으로 JSON 직렬화 후 로컬 세션에 broadcast
  - 마지막 사용자가 모두 떠나면 해당 서버의 모든 구독을 해제 (`removeSession`의 정리 로직)
- **`MessageSequenceService`**: Redis `INCR` 원자 연산으로 채팅방별 메시지 시퀀스 번호 부여. 메시지 정렬 일관성 보장용.

#### 5-3. Redis 통합 (`redis/`)
**`RedisMessageBroker`**는 분산 서버의 핵심 컴포넌트입니다.
- `serverId`를 `HOSTNAME` 환경변수 또는 타임스탬프로 결정
- `subscribeRooms` Set으로 현재 구독 중인 방 추적
- `broadcastToRoom`: `DistributedMessage`로 래핑 후 `chat.room.{roomId}` 채널에 publish
- `onMessage`: 수신 시 `excludeServerId`로 본인 메시지 필터링, `processedMessages` 캐시로 **중복 수신 방지**
- `@Scheduled(fixedRate = 60000, initialDelay = 30000)`로 60초 이상 된 `processedMessages` 엔트리 주기적 정리 (`chat-persistence/src/main/kotlin/redis/RedisMessageBroker.kt:135-147`)
- `@PreDestroy` 시점에 전체 구독 해제

#### 5-4. 설정 (`config/`)
- **`RedisConfig`**: `RedisTemplate<String, String>` (String 직렬화), `RedisMessageListenerContainer` (CachedThreadPool 기반 데몬 스레드). Jackson `JavaTimeModule` + `KotlinModule`이 설정된 `distributedObjectMapper` Bean 제공.
- **`CacheConfig`**: `@EnableCaching`. 캐시별 TTL 차등 설정 — `users` 1시간, `chatRooms` 15분, `chatRoomMembers` 10분, `messages` 5분. `GenericJackson2JsonRedisSerializer` 사용. (`chat-persistence/src/main/kotlin/config/CacheConfig.kt:20-42`)

### 의존성
- `chat-domain`
- `spring-boot-starter-data-jpa`, `spring-boot-starter-data-redis`, `spring-boot-starter-cache`, `spring-boot-starter-websocket`
- `jackson-module-kotlin`, `jackson-datatype-jsr310`
- 런타임: `h2`, `postgresql`

### 특이사항
`WebSocketSessionManager`는 WebSocket 기능이지만 **persistence에 위치**합니다. 이는 Redis와 깊이 결합된 분산 세션 관리 로직이기 때문에 `chat-persistence`에 두어 WebSocket 모듈의 결합을 낮추고 `ChatServiceImpl`에서도 직접 사용할 수 있게 한 설계 결정입니다.

---

## 6. chat-websocket — 실시간 통신 계층

**위치**: `chat-websocket/`

**핵심 구성**
- `config/WebSocketConfig.kt`
- `handler/ChatWebSocketHandler.kt`
- `interceptor/WebSocketHandshakeInterceptor.kt`

### 역할
WebSocket 연결 수립, 메시지 수신/파싱, 에러 응답을 담당합니다. 메시지 처리의 핵심 로직은 `ChatService`(구현은 `ChatServiceImpl`)로 위임합니다.

### 주요 구성 요소

#### `WebSocketConfig`
- `@EnableWebSocket`과 `WebSocketConfigurer`로 `/ws/chat` 엔드포인트에 핸들러와 인터셉터를 등록.
- `setAllowedOrigins("*")` — 개발용, 배포 시 도메인 제한 필요.

#### `WebSocketHandshakeInterceptor`
- 핸드셰이크 시점에 URL 쿼리스트링 `userId`를 파싱해 세션 속성에 저장.
- 예: `ws://localhost:8080/chat?userId=123`
- `userId` 없으면 false 반환 → 연결 거부.

#### `ChatWebSocketHandler`
- `afterConnectionEstablished`: 
  - `WebSocketSessionManager.addSession` 호출
  - `loadUserChatRooms`로 사용자가 속한 채팅방(최대 100개)을 조회해 `joinRoom` 처리 — Redis 채널 구독이 이 시점에 완료됨
- `handleMessage`: 텍스트 메시지만 처리. `extractMessageType`으로 먼저 `type` 필드만 파싱 후 분기.
  - `SEND_MESSAGE` 타입: `chatRoomId`, `messageType`, `content`를 꺼내 `SendMessageRequest`로 빌드 후 `chatService.sendMessage` 호출
  - 알 수 없는 타입: `ErrorMessage`로 에러 응답
- `handleTransportError`: `EOFException`은 정상 연결 종료로 간주하여 DEBUG 레벨로만 기록.
- `afterConnectionClosed`: 세션 제거.

### 의존성
- `chat-domain` (DTO, `ChatService` 인터페이스)
- `chat-persistence` (`WebSocketSessionManager`, `RedisMessageBroker`)
- `spring-boot-starter-websocket`, `spring-boot-starter-data-redis`
- `spring-data-commons` (채팅방 목록 페이징 로드)
- `jackson-module-kotlin`

---

## 7. 메시지 전송 플로우 (전 모듈 상호작용)

분산 서버에서 메시지 한 건이 어떻게 전파되는지 추적합니다.

```
[User A @ Server 1]                     [Server 2]              [User B @ Server 2]
         │                                   │                          │
 1. WS send "SEND_MESSAGE"                   │                          │
         │                                   │                          │
         ▼                                   │                          │
 ChatWebSocketHandler                        │                          │
 .handleTextMessage                          │                          │
         │                                   │                          │
         ▼                                   │                          │
 ChatService.sendMessage                     │                          │
 (ChatServiceImpl)                           │                          │
         │                                   │                          │
 2. MessageSequenceService.getNextSequence (Redis INCR)                 │
 3. MessageRepository.save   (Postgres)      │                          │
 4. WebSocketSessionManager.sendMessageToLocalRoom                     │
    -> 같은 서버의 참여자에게 즉시 push       │                          │
 5. RedisMessageBroker.broadcastToRoom       │                          │
    -> Redis Pub "chat.room.{id}"            │                          │
                                             │                          │
                                             ▼                          │
                                  RedisMessageBroker.onMessage          │
                                  - excludeServerId 체크                │
                                  - processedMessages 중복 방지         │
                                             │                          │
                                             ▼                          │
                                  localMessageHandler                   │
                                  (WebSocketSessionManager              │
                                   .sendMessageToLocalRoom)             │
                                             │                          │
                                             ▼                          │
                                  WS session for User B ────────────────▶ 수신
```

- Server 1은 **로컬 전송 + Pub 을 동시에** 수행하므로 같은 서버 사용자는 Redis 왕복 없이 즉시 메시지를 받습니다. (`ChatServiceImpl.sendMessage` — 주석 "1. 로컬 세션에 즉시 전송 / 2. 다른 서버 인스턴스에 브로드캐스트")
- Server 2는 Redis 구독 시점(`joinRoom` → `subscribeToRoom`)부터 해당 방의 메시지를 수신합니다.
- `DistributedMessage.excludeServerId`로 자기 자신의 publish는 무시하여 echo 루프를 방지합니다.

---

## 8. 모듈 구성 요약표

| 모듈 | 의존 | 실행가능? | 주요 책임 |
|------|------|----------|----------|
| chat-domain | — | ✗ (Jar) | 엔티티, DTO, 서비스 인터페이스 |
| chat-api | chat-domain | ✗ | REST 컨트롤러 (`/users`, `/chat-rooms`) |
| chat-persistence | chat-domain | ✗ | JPA 리포지토리, 서비스 구현, Redis Pub/Sub, 세션 매니저, 캐시 |
| chat-websocket | chat-domain, chat-persistence | ✗ | WebSocket 핸드셰이크/핸들러, 메시지 라우팅 |
| chat-application | 전 모듈 | ✓ (BootJar) | `@SpringBootApplication` 진입점, JPA 설정, DB 드라이버 주입 |

---

## 9. 설계상의 관찰 포인트

1. **순수 도메인 모듈 분리**: `chat-domain`은 인프라 의존이 최소화되어 있어 서비스 인터페이스만으로 계약이 명세됩니다. 테스트 시 구현체를 자유롭게 교체 가능.
2. **REST/WS 경로 분리**: 메시지 "전송"은 WebSocket, "조회"는 REST로 완전히 분리되어 두 계층의 책임이 명확합니다.
3. **분산 세션 일관성**: `WebSocketSessionManager`가 Redis Set(`chat:server:rooms{serverId}`)에 자기 서버가 구독한 방을 기록함으로써 서버 종료/사용자 해제 시 구독 해제 정리가 가능합니다.
4. **중복 브로드캐스트 방지**: `RedisMessageBroker.processedMessages`를 통해 메시지 ID 단위로 중복 처리를 막고 있고 @Scheduled로 주기적 정리까지 구현되어 있습니다.
5. **커서 기반 페이지네이션**: 오프셋 기반 대비 대규모 히스토리 조회 시 성능 이점을 가지며 `JOIN FETCH`로 N+1 문제도 동시에 해소.
6. **세션 매니저의 위치**: 전통적으로 WebSocket 패키지에 둘 법한 컴포넌트를 `chat-persistence`에 둔 것은 Redis 의존성을 `chat-websocket`에 침투시키지 않고 `ChatServiceImpl`과 같은 도메인 서비스도 직접 세션을 조작할 수 있게 하려는 의도로 보입니다.
