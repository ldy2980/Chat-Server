package com.chat.application

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.autoconfigure.domain.EntityScan
import org.springframework.boot.runApplication
import org.springframework.data.jpa.repository.config.EnableJpaAuditing
import org.springframework.data.jpa.repository.config.EnableJpaRepositories

@SpringBootApplication(
    scanBasePackages = [
        "com.chat.application"
    // TODO -> 모듈이 추가됨에 따라 계속 추가
    /*
    * com.chat.api          // REST API
    * com.chat.domain       // 도메인 모델과 서비스 인터페이스
    * com.chat.persistence  // repository와 서비스 클래스 구현체
    * com.chat.websocket    // ws 통신에 대한 관련 컴포넌트들
    * */
    ]
)
@EnableJpaAuditing  // JPA에 대한 감사 기능 @CreatedDate
@EnableJpaRepositories(basePackages = ["com.chat.persistence.repository"])
@EntityScan(basePackages = ["com.chat.domain.model"])
class ChatApplication

fun main(args: Array<String>) {
    runApplication<ChatApplication>(*args)
}