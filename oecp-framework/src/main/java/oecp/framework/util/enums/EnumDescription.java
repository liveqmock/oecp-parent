package oecp.framework.util.enums;


import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 枚举描述，标注到枚举类内的项目上。
 * 
 * @author slx
 * @date 2009-9-2 下午05:13:57
 * @version 1.0
 */
@Target( {ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
public @interface EnumDescription {
	
	String value();
}
